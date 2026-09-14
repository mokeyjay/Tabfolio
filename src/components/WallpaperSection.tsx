import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  defaultAnimateLayoutChanges,
  rectSortingStrategy,
  useSortable,
  type AnimateLayoutChanges,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BackgroundFolder, LinkedWallpaper, RotateMode, Settings, Wallpaper } from '../types'
import { useApp } from '../app/AppContext'
import { updateSettings, updateSettingsNow } from '../state/settingsStore'
import { PRESET_WALLPAPERS } from '../state/settingsSchema'
import { rotationWallpapers } from '../state/wallpaper'
import {
  BingPermissionManifestError,
  ensureBingWallpaper,
  getBingWallpaperState,
  requestBingPermission,
  useBingWallpaperState,
} from '../state/bingWallpaper'
import {
  directoryFilesInFolder,
  linkDirectory,
  moveDirectoryFile,
  refreshDirectory,
  reorderDirectoryFilesInFolder,
  supportsDirectoryPicker,
  unlinkDirectory,
  useDirectorySources,
  useLinkedImage,
} from '../state/directoryStore'
import { newImageId, putImage, removeImage } from '../platform/blobs'
import { getDeviceId } from '../platform/env'
import { invalidateLocalImage, useLocalImage } from '../hooks/useLocalImage'
import { GradientMaker } from './GradientMaker'
import { NumberSetting, Segmented } from './ui'
import { useMessages, type Messages } from '../i18n'
import {
  IconCheck,
  IconChevronRight,
  IconClose,
  IconExternal,
  IconFolderAdd,
  IconFolderOpen,
  IconGlobal,
  IconImageAdd,
  IconLink,
  IconPalette,
  IconReset,
  IconRestore,
  IconSelectAll,
  IconSelectNone,
  IconUnlink,
} from './icons'

function rotateModes(t: Messages): { value: RotateMode; label: string }[] {
  return [
    { value: 'off', label: t.wallpaper.rotateOff },
    { value: 'sequential', label: t.wallpaper.rotateSequential },
    { value: 'random', label: t.wallpaper.rotateRandom },
  ]
}

type WallpaperSource = 'custom' | 'bing'

type ItemDragData =
  | { kind: 'item'; itemType: 'wall' | 'folder' | 'linked'; id: string; parentId: string | null; sourceId?: string; path?: string }
  | { kind: 'into'; folderId: string | null }

function dragId(type: 'wall' | 'folder' | 'linked', id: string): string {
  return `${type}:${id}`
}

function childFolderIds(folders: BackgroundFolder[], id: string): Set<string> {
  const out = new Set<string>()
  const visit = (parentId: string) => {
    for (const folder of folders) {
      if (folder.parentId !== parentId || out.has(folder.id)) continue
      out.add(folder.id)
      visit(folder.id)
    }
  }
  visit(id)
  return out
}

type Background = Settings['background']
/** 选择状态就这两个字段，所有选择操作都是「拿旧的算出新的」 */
type Selection = Pick<Background, 'selectedIds' | 'selectedFolderIds'>
type CheckState = 'on' | 'partial' | 'off'

/**
 * 选择模型有两种记法：
 *   selectedFolderIds —— 整个目录都要(连同以后往里加的东西)，一个 id 顶一整棵子树；
 *   selectedIds       —— 逐张点的。
 * 关联目录动辄几千张图，没有前者的话光选中标记就能把可同步设置撑爆，所以两种都得留。
 *
 * 代价是「目录勾没勾」和「里面的图勾没勾」是两条线，得靠下面这几个函数合起来算，
 * 界面上才是一套一致的三态。
 */
function folderTreeIds(folders: BackgroundFolder[], rootId: string): Set<string> {
  return new Set([rootId, ...childFolderIds(folders, rootId)])
}

function wallIdsInTree(bg: Background, folderIds: Set<string>): Set<string> {
  return new Set([
    ...bg.wallpapers.filter((wall) => wall.parentId && folderIds.has(wall.parentId)).map((wall) => wall.id),
    ...[...folderIds].flatMap((id) => directoryFilesInFolder(id).map((wall) => wall.id)),
  ])
}

/** 目录直属的那一层条目(不递归) */
function directChildren(bg: Background, folderId: string | null) {
  return {
    wallIds: [
      ...bg.wallpapers.filter((wall) => wall.parentId === folderId).map((wall) => wall.id),
      ...directoryFilesInFolder(folderId).map((wall) => wall.id),
    ],
    folderIds: bg.folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id),
  }
}

/**
 * 目录该画成全选 / 半选 / 未选。
 *
 * 整目录选中直接算全选；否则按里面的东西数：子目录递归算，自己全中才算一份。
 * 空目录没有可选的东西，画成未选。
 */
function folderCheckState(
  bg: Background,
  folderId: string,
  seen: Set<string> = new Set(),
): CheckState {
  if (bg.selectedFolderIds.includes(folderId)) return 'on'
  if (seen.has(folderId)) return 'off'
  seen.add(folderId)

  const selected = new Set(bg.selectedIds)
  const { wallIds, folderIds } = directChildren(bg, folderId)
  let total = wallIds.length
  let on = wallIds.filter((id) => selected.has(id)).length
  let anyPartial = false
  for (const childId of folderIds) {
    total += 1
    const state = folderCheckState(bg, childId, seen)
    if (state === 'on') on += 1
    else if (state === 'partial') anyPartial = true
  }
  if (!total) return 'off'
  if (on === total) return 'on'
  return on || anyPartial ? 'partial' : 'off'
}

/** 整目录选中：子树里那些逐项记的标记就成了冗余，一并清掉免得以后对不上 */
function selectFolder(bg: Background, folderId: string): Selection {
  const ids = folderTreeIds(bg.folders, folderId)
  const walls = wallIdsInTree(bg, ids)
  return {
    selectedIds: bg.selectedIds.filter((id) => !walls.has(id)),
    selectedFolderIds: [
      ...bg.selectedFolderIds.filter((id) => !ids.has(id)),
      folderId,
    ],
  }
}

/** 取消整棵子树：整目录标记和逐项标记都得清，只清一种会留下半选的假象 */
function deselectFolder(bg: Background, folderId: string): Selection {
  const ids = folderTreeIds(bg.folders, folderId)
  const walls = wallIdsInTree(bg, ids)
  return {
    selectedIds: bg.selectedIds.filter((id) => !walls.has(id)),
    selectedFolderIds: bg.selectedFolderIds.filter((id) => !ids.has(id)),
  }
}

/**
 * 把「祖先整目录选中」摊开成逐项选中，直到 chain 末端这一层。
 *
 * 模型里没有「选了整个目录、但排除其中某张」这种状态，所以进到一个继承选中的目录里
 * 想单独取消一张时，得先把那个祖先换算成「它的每个直接子项各自选中」，一层层推下来。
 * 推的过程中不碰旁支 —— 兄弟目录仍旧用一个 id 表示整选，不会展开成几千个。
 */
function materializeInheritance(bg: Background, chain: BackgroundFolder[]): Selection {
  let selection: Selection = {
    selectedIds: bg.selectedIds,
    selectedFolderIds: bg.selectedFolderIds,
  }
  const start = chain.findIndex((folder) => selection.selectedFolderIds.includes(folder.id))
  if (start === -1) return selection

  for (let i = start; i < chain.length; i += 1) {
    const folder = chain[i]
    const next = chain[i + 1]
    const { wallIds, folderIds } = directChildren(bg, folder.id)
    selection = {
      selectedIds: [...new Set([...selection.selectedIds, ...wallIds])],
      selectedFolderIds: [
        ...new Set([
          ...selection.selectedFolderIds.filter((id) => id !== folder.id),
          // 下一层还要接着摊开，别在这里按整选记
          ...folderIds.filter((id) => id !== next?.id),
        ]),
      ],
    }
  }
  return selection
}

function nextWallpaperOrder(
  wallpapers: Wallpaper[],
  parentId: string | null,
): number {
  const orders = [
    ...wallpapers.filter((wall) => wall.parentId === parentId).map((wall) => wall.order),
    ...directoryFilesInFolder(parentId).map((wall) => wall.order),
  ]
  return Math.max(-1, ...orders) + 1
}

function nextFolderOrder(folders: BackgroundFolder[], parentId: string | null): number {
  const orders = folders
    .filter((folder) => folder.parentId === parentId)
    .map((folder) => folder.order)
  return Math.max(-1, ...orders) + 1
}

function wallStyle(wall: Wallpaper, localSrc: string | null | undefined): CSSProperties | undefined {
  if (wall.kind === 'preset') return { background: wall.css }
  const src = wall.kind === 'url' ? wall.url : localSrc
  return src
    ? {
        backgroundImage: `url("${src}")`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }
    : undefined
}

/** 落位后的布局更新不再补一次过渡，避免整组卡片先回弹再跳到新位置。 */
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  args.isSorting || args.wasDragging ? false : defaultAnimateLayoutChanges(args)

function SortableWallpaper({
  wall,
  selected,
  onToggle,
  onDelete,
}: {
  wall: Wallpaper
  selected: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const t = useMessages()
  const localSrc = useLocalImage(wall.kind === 'local' ? wall.id : undefined)
  const missing = wall.kind === 'local' && localSrc === null
  const sortable = useSortable({
    id: dragId('wall', wall.id),
    data: { kind: 'item', itemType: 'wall', id: wall.id, parentId: wall.parentId } satisfies ItemDragData,
    animateLayoutChanges,
    transition: { duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })
  const style = sortable.transform
    ? { ...wallStyle(wall, localSrc), transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }
    : wallStyle(wall, localSrc)
  return (
    <div
      ref={sortable.setNodeRef}
      className={`bnt-wall${selected ? ' is-on' : ''}${sortable.isDragging ? ' is-dragging' : ''}`}
      style={style}
      title={wall.name}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={onToggle}
    >
      {missing && <span className="bnt-wall-missing">{t.wallpaper.dataMissing}</span>}
      <span className="bnt-wall-name">{wall.name}</span>
      {selected && <span className="bnt-wall-check"><IconCheck size={11} /></span>}
      <button
        type="button"
        className="bnt-wall-del"
        aria-label={t.wallpaper.removeWallpaper(wall.name)}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
      >
        <IconClose size={11} />
      </button>
    </div>
  )
}

function SortableLinkedWallpaper({
  wall,
  selected,
  onToggle,
}: {
  wall: LinkedWallpaper
  selected: boolean
  onToggle: () => void
}) {
  const t = useMessages()
  const src = useLinkedImage(wall)
  const sortable = useSortable({
    id: dragId('linked', wall.id),
    data: {
      kind: 'item',
      itemType: 'linked',
      id: wall.id,
      parentId: wall.parentId,
      sourceId: wall.sourceId,
      path: wall.path,
    } satisfies ItemDragData,
    animateLayoutChanges,
    transition: { duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })
  return (
    <div
      ref={sortable.setNodeRef}
      className={`bnt-wall${selected ? ' is-on' : ''}${sortable.isDragging ? ' is-dragging' : ''}`}
      style={{
        ...(src ? {
          backgroundImage: `url("${src}")`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        } : {}),
        ...(sortable.transform ? {
          transform: CSS.Translate.toString(sortable.transform),
          transition: sortable.transition,
        } : {}),
      }}
      title={`${wall.path}\n${t.wallpaper.linkedFileHint}`}
      {...sortable.attributes}
      {...sortable.listeners}
      onClick={onToggle}
    >
      {src === null && <span className="bnt-wall-missing">{t.wallpaper.unreadable}</span>}
      <span className="bnt-wall-name">{wall.path}</span>
      {selected && <span className="bnt-wall-check"><IconCheck size={11} /></span>}
    </div>
  )
}

function SortableFolder({
  folder,
  state,
  count,
  onOpen,
  onToggle,
  onDelete,
}: {
  folder: BackgroundFolder
  /** 里面的东西全选中 / 选中一部分 / 都没选 */
  state: CheckState
  count: number
  onOpen: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const active = state === 'on'
  const t = useMessages()
  const sortable = useSortable({
    id: dragId('folder', folder.id),
    data: { kind: 'item', itemType: 'folder', id: folder.id, parentId: folder.parentId } satisfies ItemDragData,
    animateLayoutChanges,
    transition: { duration: 150, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })
  const into = useDroppable({
    id: `into:${folder.id}`,
    data: { kind: 'into', folderId: folder.id } satisfies ItemDragData,
  })
  return (
    <div
      ref={sortable.setNodeRef}
      className={`bnt-wall-folder${sortable.isDragging ? ' is-dragging' : ''}`}
      style={sortable.transform ? {
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      } : undefined}
      {...sortable.attributes}
      {...sortable.listeners}
    >
      <button type="button" className="bnt-wall-folder-open" onClick={onOpen}>
        <IconFolderOpen size={24} />
        <span>{folder.name}</span>
        <small>
          {folder.linkedSourceId ? t.wallpaper.linkedCount(count) : t.wallpaper.imageCount(count)}
        </small>
      </button>
      <span ref={into.setNodeRef} className={`bnt-wall-folder-into${into.isOver ? ' is-over' : ''}`} />
      <button
        type="button"
        role="checkbox"
        aria-checked={active ? true : state === 'partial' ? 'mixed' : false}
        className={`bnt-wall-folder-check${active ? ' is-on' : ''}${
          state === 'partial' ? ' is-partial' : ''
        }`}
        aria-label={
          active ? t.wallpaper.deselectFolder(folder.name) : t.wallpaper.selectFolder(folder.name)
        }
        title={state === 'partial' ? t.wallpaper.partialHint : undefined}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        {active && <IconCheck size={11} />}
      </button>
      <button
        type="button"
        className="bnt-wall-del"
        aria-label={t.wallpaper.deleteFolder(folder.name)}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
      >
        <IconClose size={11} />
      </button>
    </div>
  )
}

function BreadcrumbDrop({
  id,
  label,
  onClick,
}: {
  id: string | null
  label: string
  onClick: () => void
}) {
  const drop = useDroppable({
    id: `breadcrumb-into:${id ?? 'root'}`,
    data: { kind: 'into', folderId: id } satisfies ItemDragData,
  })
  return (
    <span ref={drop.setNodeRef} className={drop.isOver ? 'is-over' : ''}>
      <IconChevronRight size={13} />
      <button type="button" onClick={onClick}>{label}</button>
    </span>
  )
}

/** 指针命中的落点优先；没有命中时再按卡片中心排序。 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length) {
    const area = (id: (typeof hits)[number]['id']) => {
      const rect = args.droppableRects.get(id)
      return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY
    }
    return [...hits].sort((a, b) => area(a.id) - area(b.id))
  }
  return closestCenter(args)
}

export function WallpaperSection() {
  const { settings, showToast, askConfirm } = useApp()
  const t = useMessages()
  const bg = settings.background
  const directoryState = useDirectorySources()
  const bing = useBingWallpaperState()
  const fileRef = useRef<HTMLInputElement>(null)
  const draggedAt = useRef(0)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [urlDraft, setUrlDraft] = useState<string | null>(null)
  const [folderDraft, setFolderDraft] = useState<string | null>(null)
  const [makerOpen, setMakerOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [bingWorking, setBingWorking] = useState(false)
  const [visibleLinked, setVisibleLinked] = useState(80)
  const [isSorting, setIsSorting] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    if (currentFolderId && !bg.folders.some((folder) => folder.id === currentFolderId)) {
      setCurrentFolderId(null)
    }
  }, [bg.folders, currentFolderId])

  const currentFolder = currentFolderId
    ? bg.folders.find((folder) => folder.id === currentFolderId)
    : undefined
  // 根目录到当前目录的整条链，继承判断和「摊开继承」都要按这条链走
  const breadcrumbs: BackgroundFolder[] = []
  {
    let cursor = currentFolderId
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      const folder = bg.folders.find((item) => item.id === cursor)
      if (!folder) break
      breadcrumbs.unshift(folder)
      cursor = folder.parentId
    }
  }
  /** 当前目录本身或某个祖先被整目录选中 —— 这一层的东西全都算已选 */
  const inherited = breadcrumbs.some((folder) => bg.selectedFolderIds.includes(folder.id))
  const directFolders = bg.folders
    .filter((folder) => folder.parentId === currentFolderId)
    .sort((a, b) => a.order - b.order)
  const directWalls = bg.wallpapers
    .filter((wall) => wall.parentId === currentFolderId)
    .sort((a, b) => a.order - b.order)
  const linkedWalls = directoryFilesInFolder(currentFolderId)
  const currentSource = currentFolder?.linkedSourceId
    ? directoryState.sources[currentFolder.linkedSourceId]
    : undefined
  const canLink = !!currentFolder && !currentFolder.linkedSourceId &&
    !directFolders.length && !directWalls.length && !linkedWalls.length
  const isLinkedFolder = !!currentFolder?.linkedSourceId
  const rotationCount = useMemo(
    () => rotationWallpapers(settings).length,
    [settings, directoryState.sources],
  )

  const patchBg = (patch: Partial<typeof bg>) =>
    updateSettings((prev) => ({ ...prev, background: { ...prev.background, ...patch } }))

  const loadBing = async (): Promise<boolean> => {
    setBingWorking(true)
    try {
      if (!await requestBingPermission()) {
        showToast(t.wallpaper.bingPermissionDenied)
        return false
      }
      const wallpaper = await ensureBingWallpaper(true)
      if (!wallpaper) {
        showToast(t.wallpaper.bingLoadFailed(
          getBingWallpaperState().error ?? t.wallpaper.bingNoImage,
        ))
        return false
      }
      return true
    } catch (cause) {
      showToast(
        cause instanceof BingPermissionManifestError
          ? t.wallpaper.bingManifestReload
          : t.wallpaper.bingLoadFailed(cause instanceof Error ? cause.message : String(cause)),
      )
      return false
    } finally {
      setBingWorking(false)
    }
  }

  const selectWallpaperSource = async (source: WallpaperSource) => {
    try {
      await updateSettingsNow((prev) => ({
        ...prev,
        background: { ...prev.background, bingEnabled: source === 'bing' },
      }))
    } catch (cause) {
      showToast(t.settings.saveFailed(cause instanceof Error ? cause.message : String(cause)))
    }
  }

  /** 改这一层的选择之前，先把继承来的整目录选中摊开成逐项，不然单项改不动 */
  const editable = (): Background =>
    inherited ? { ...bg, ...materializeInheritance(bg, breadcrumbs) } : bg

  const toggleWall = (id: string) => {
    if (Date.now() - draggedAt.current < 250) return
    const base = editable()
    patchBg({
      selectedFolderIds: base.selectedFolderIds,
      selectedIds: base.selectedIds.includes(id)
        ? base.selectedIds.filter((selectedId) => selectedId !== id)
        : [...base.selectedIds, id],
    })
  }

  /** 目录的勾选框走三态：没全中就整个勾上，全中了就整棵清掉 */
  const toggleFolder = (id: string) => {
    const base = editable()
    patchBg(
      folderCheckState(base, id) === 'on'
        ? deselectFolder(base, id)
        : selectFolder(base, id),
    )
  }

  /*
   * 全选 / 取消全选管当前这一层：直接子图片逐张记，直接子目录按整目录记 ——
   * 勾上一个目录等于连它的子孙一起要，没必要递归下去逐个勾。
   * 图片取的是全量而不是 visiblePictures —— 关联目录是滚动到哪加载到哪，
   * 按「加载了多少」来全选会让同一个按钮每次的结果都不一样。
   */
  const levelWallIds = [...directWalls, ...linkedWalls].map((wall) => wall.id)
  const levelStates: CheckState[] = [
    ...levelWallIds.map((id): CheckState =>
      inherited || bg.selectedIds.includes(id) ? 'on' : 'off',
    ),
    ...directFolders.map((folder): CheckState =>
      inherited ? 'on' : folderCheckState(bg, folder.id),
    ),
  ]
  const levelCount = levelStates.length
  const allSelected = !!levelCount && levelStates.every((state) => state === 'on')
  const noneSelected = levelStates.every((state) => state === 'off')

  const selectAll = () => {
    let base = editable()
    for (const folder of directFolders) base = { ...base, ...selectFolder(base, folder.id) }
    patchBg({
      selectedFolderIds: base.selectedFolderIds,
      selectedIds: [...new Set([...base.selectedIds, ...levelWallIds])],
    })
  }

  const clearAll = () => {
    let base = editable()
    for (const folder of directFolders) base = { ...base, ...deselectFolder(base, folder.id) }
    const walls = new Set(levelWallIds)
    patchBg({
      selectedFolderIds: base.selectedFolderIds,
      selectedIds: base.selectedIds.filter((id) => !walls.has(id)),
    })
  }

  const orderedDirectItems = (group: 'folder' | 'picture') => (
    group === 'folder'
      ? bg.folders.filter((folder) => folder.parentId === currentFolderId)
        .map((folder) => ({ key: dragId('folder', folder.id), order: folder.order }))
      : [
          ...bg.wallpapers.filter((wall) => wall.parentId === currentFolderId)
            .map((wall) => ({ key: dragId('wall', wall.id), order: wall.order })),
          ...linkedWalls.map((wall) => ({ key: dragId('linked', wall.id), order: wall.order })),
        ]
  ).sort((a, b) => a.order - b.order)

  const onDragEnd = (event: DragEndEvent) => {
    draggedAt.current = Date.now()
    setIsSorting(false)
    const source = event.active.data.current as ItemDragData | undefined
    const target = event.over?.data.current as ItemDragData | undefined
    if (!source || source.kind !== 'item' || !target) return

    if (target.kind === 'into') {
      const destination = target.folderId
      if (destination === source.parentId) return
      const destFolder = destination
        ? bg.folders.find((folder) => folder.id === destination)
        : undefined
      if (destFolder?.linkedSourceId &&
        !(source.itemType === 'linked' && source.sourceId === destination)) {
        showToast(t.wallpaper.linkedFolderLocked)
        return
      }
      if (source.itemType === 'folder') {
        if (destination === source.id || childFolderIds(bg.folders, source.id).has(destination ?? '')) return
      }
      const order = source.itemType === 'folder'
        ? nextFolderOrder(bg.folders, destination)
        : nextWallpaperOrder(bg.wallpapers, destination)
      if (source.itemType === 'linked' && source.sourceId && source.path) {
        void moveDirectoryFile(source.sourceId, source.path, destination, order).catch((cause: unknown) =>
          showToast(t.wallpaper.moveFailed(cause instanceof Error ? cause.message : String(cause))),
        )
        return
      }
      patchBg({
        wallpapers: bg.wallpapers.map((wall) =>
          source.itemType === 'wall' && wall.id === source.id
            ? { ...wall, parentId: destination, order }
            : wall,
        ),
        folders: bg.folders.map((folder) =>
          source.itemType === 'folder' && folder.id === source.id
            ? { ...folder, parentId: destination, order }
            : folder,
        ),
      })
      return
    }

    if (source.parentId !== target.parentId || source.id === target.id) return
    const sourceGroup = source.itemType === 'folder' ? 'folder' : 'picture'
    const targetGroup = target.itemType === 'folder' ? 'folder' : 'picture'
    if (sourceGroup !== targetGroup) return
    const items = orderedDirectItems(sourceGroup)
    const from = items.findIndex((item) => item.key === event.active.id)
    const to = items.findIndex((item) => item.key === event.over?.id)
    if (from === -1 || to === -1 || from === to) return
    const positions = new Map(arrayMove(items, from, to).map((item, index) => [item.key, index]))
    patchBg({
      wallpapers: bg.wallpapers.map((wall) => ({
        ...wall,
        order: positions.get(dragId('wall', wall.id)) ?? wall.order,
      })),
      folders: bg.folders.map((folder) => ({
        ...folder,
        order: positions.get(dragId('folder', folder.id)) ?? folder.order,
      })),
    })
    const linkedPositions = new Map(linkedWalls.flatMap((wall) => {
      const order = positions.get(dragId('linked', wall.id))
      return order === undefined ? [] : [[wall.id, order] as const]
    }))
    void reorderDirectoryFilesInFolder(currentFolderId, linkedPositions).catch((cause: unknown) =>
      showToast(t.wallpaper.reorderFailed(cause instanceof Error ? cause.message : String(cause))),
    )
  }

  const removeWall = async (wall: Wallpaper) => {
    try {
      await updateSettingsNow((prev) => ({
        ...prev,
        background: {
          ...prev.background,
          wallpapers: prev.background.wallpapers.filter((item) => item.id !== wall.id),
          selectedIds: prev.background.selectedIds.filter((id) => id !== wall.id),
        },
      }))
      if (wall.kind === 'local') {
        await removeImage(wall.id).catch((cause: unknown) =>
          console.error('清理已移除壁纸的本地图片失败', cause),
        )
        invalidateLocalImage(wall.id)
      }
    } catch (cause) {
      showToast(t.wallpaper.removeFailed(cause instanceof Error ? cause.message : String(cause)))
    }
  }

  /** 目录里的东西跟着目录一起删。磁盘上的文件不动 —— 关联目录删的只是扩展这边的索引。 */
  const removeFolder = (folder: BackgroundFolder) => {
    const descendants = childFolderIds(bg.folders, folder.id)
    const ids = new Set([folder.id, ...descendants])
    const walls = bg.wallpapers.filter((wall) => wall.parentId && ids.has(wall.parentId))
    askConfirm({
      title: t.wallpaper.deleteFolderTitle(folder.name),
      message: t.wallpaper.deleteFolderMessage(walls.length),
      confirmLabel: t.wallpaper.deleteFolderConfirm,
      danger: true,
      onConfirm: async () => {
        await updateSettingsNow((prev) => ({
          ...prev,
          background: {
            ...prev.background,
            selectedFolderIds: prev.background.selectedFolderIds.filter((id) => !ids.has(id)),
            selectedIds: prev.background.selectedIds.filter((id) =>
              !walls.some((wall) => wall.id === id) &&
              ![...ids].some((folderId) => id.startsWith(`linked:${folderId}:`)),
            ),
            folders: prev.background.folders.filter((item) => !ids.has(item.id)),
            wallpapers: prev.background.wallpapers.filter((wall) => !wall.parentId || !ids.has(wall.parentId)),
          },
        }))
        await Promise.allSettled([
          ...[...ids].map((id) => unlinkDirectory(id)),
          ...walls.filter((wall) => wall.kind === 'local').map(async (wall) => {
            await removeImage(wall.id)
            invalidateLocalImage(wall.id)
          }),
        ])
        if (currentFolderId && ids.has(currentFolderId)) setCurrentFolderId(folder.parentId)
      },
    })
  }

  const addLocal = async (file: File | undefined) => {
    if (!file?.type.startsWith('image/') || isLinkedFolder) return
    const id = newImageId()
    try {
      await putImage(id, file)
      invalidateLocalImage(id)
      const wall: Wallpaper = {
        id,
        kind: 'local',
        name: file.name.replace(/\.[^.]+$/, ''),
        mime: file.type,
        deviceId: getDeviceId(),
        parentId: currentFolderId,
        order: nextWallpaperOrder(bg.wallpapers, currentFolderId),
      }
      await updateSettingsNow((prev) => ({
        ...prev,
        background: {
          ...prev.background,
          wallpapers: [...prev.background.wallpapers, wall],
          selectedIds: [...prev.background.selectedIds, wall.id],
        },
      }))
    } catch (cause) {
      await removeImage(id).catch(() => {})
      showToast(t.wallpaper.addFailed(cause instanceof Error ? cause.message : String(cause)))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const addUrl = (raw: string) => {
    const url = raw.trim()
    if (!url || isLinkedFolder) return
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      showToast(t.wallpaper.invalidUrl)
      return
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      showToast(t.wallpaper.urlProtocol)
      return
    }
    const wall: Wallpaper = {
      id: newImageId(),
      kind: 'url',
      name: parsed.hostname,
      url: parsed.toString(),
      parentId: currentFolderId,
      order: nextWallpaperOrder(bg.wallpapers, currentFolderId),
    }
    patchBg({
      wallpapers: [...bg.wallpapers, wall],
      selectedIds: [...bg.selectedIds, wall.id],
    })
    setUrlDraft(null)
  }

  const addFolder = () => {
    const name = folderDraft?.trim()
    if (!name || isLinkedFolder) return
    const folder: BackgroundFolder = {
      id: `bg-folder-${newImageId()}`,
      name,
      parentId: currentFolderId,
      order: nextFolderOrder(bg.folders, currentFolderId),
    }
    patchBg({ folders: [...bg.folders, folder] })
    setFolderDraft(null)
  }

  const associate = async () => {
    if (!currentFolder || (!canLink && !currentFolder.linkedSourceId)) return
    setWorking(true)
    try {
      const source = await linkDirectory(currentFolder.id)
      const validIds = new Set(source.files.map((file) => `linked:${source.id}:${file.path}`))
      patchBg({
        selectedIds: bg.selectedIds.filter((id) =>
          !id.startsWith(`linked:${source.id}:`) || validIds.has(id),
        ),
        folders: bg.folders.map((folder) =>
          folder.id === currentFolder.id ? { ...folder, linkedSourceId: folder.id } : folder,
        ),
      })
      showToast(t.wallpaper.linkDone(source.name, source.files.length))
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      showToast(t.wallpaper.linkFailed(cause instanceof Error ? cause.message : String(cause)))
    } finally {
      setWorking(false)
    }
  }

  const refresh = async () => {
    if (!currentFolder?.linkedSourceId) return
    setWorking(true)
    try {
      const source = await refreshDirectory(currentFolder.linkedSourceId)
      const validIds = new Set(source.files.map((file) => `linked:${source.id}:${file.path}`))
      patchBg({
        selectedIds: bg.selectedIds.filter((id) =>
          !id.startsWith(`linked:${source.id}:`) || validIds.has(id),
        ),
      })
      showToast(t.wallpaper.refreshDone(source.files.length))
    } catch (cause) {
      showToast(t.wallpaper.refreshFailed(cause instanceof Error ? cause.message : String(cause)))
    } finally {
      setWorking(false)
    }
  }

  const unlink = () => {
    if (!currentFolder?.linkedSourceId) return
    const sourceId = currentFolder.linkedSourceId
    askConfirm({
      title: t.wallpaper.unlinkTitle,
      message: t.wallpaper.unlinkMessage,
      confirmLabel: t.wallpaper.unlinkConfirm,
      danger: true,
      onConfirm: async () => {
        await unlinkDirectory(sourceId)
        patchBg({
          selectedIds: bg.selectedIds.filter((id) => !id.startsWith(`linked:${sourceId}:`)),
          folders: bg.folders.map((folder) =>
            folder.id === currentFolder.id
              ? { id: folder.id, name: folder.name, parentId: folder.parentId, order: folder.order }
              : folder,
          ),
        })
      },
    })
  }

  const restorePresets = () => {
    if (isLinkedFolder) return
    const missing = PRESET_WALLPAPERS.filter((preset) =>
      !bg.wallpapers.some((wall) => wall.id === preset.id),
    ).map((preset, index) => ({
      ...preset,
      parentId: currentFolderId,
      order: nextWallpaperOrder(bg.wallpapers, currentFolderId) + index,
    }))
    if (!missing.length) {
      showToast(t.wallpaper.restorePresetsNothing)
      return
    }
    askConfirm({
      title: t.wallpaper.restorePresetsTitle,
      message: t.wallpaper.restorePresetsMessage(missing.length),
      confirmLabel: t.wallpaper.restorePresetsConfirm,
      onConfirm: () => {
        patchBg({ wallpapers: [...bg.wallpapers, ...missing] })
        showToast(t.wallpaper.restorePresetsDone(missing.length))
      },
    })
  }

  let linkedShown = 0
  const visiblePictures = [...directWalls, ...linkedWalls]
    .sort((a, b) => a.order - b.order)
    .filter((item) => {
      if (item.kind !== 'linked') return true
      linkedShown += 1
      return linkedShown <= visibleLinked
    })
  const folderSortableIds = directFolders.map((folder) => dragId('folder', folder.id))
  const pictureSortableIds = visiblePictures.map((item) =>
    dragId(item.kind === 'linked' ? 'linked' : 'wall', item.id),
  )

  return (
    <div className="bnt-group">
      <div className="bnt-wall-source-heading">{t.wallpaper.wallpaperSource}</div>
      <div
        className="bnt-wall-source-picker"
        role="tablist"
        aria-label={t.wallpaper.wallpaperSource}
      >
        <button
          type="button"
          role="tab"
          aria-selected={!bg.bingEnabled}
          className={!bg.bingEnabled ? 'is-on' : ''}
          onClick={() => void selectWallpaperSource('custom')}
        >
          <span className="bnt-wall-source-icon"><IconPalette size={21} /></span>
          <span className="bnt-wall-source-copy">
            <strong>{t.wallpaper.customWallpapers}</strong>
            <small>{t.wallpaper.customWallpapersHint}</small>
          </span>
          <span className="bnt-wall-source-check" aria-hidden>
            {!bg.bingEnabled && <IconCheck size={12} />}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={bg.bingEnabled}
          className={bg.bingEnabled ? 'is-on' : ''}
          onClick={() => void selectWallpaperSource('bing')}
        >
          <span className="bnt-wall-source-icon"><IconGlobal size={21} /></span>
          <span className="bnt-wall-source-copy">
            <strong>{t.wallpaper.bingWallpapers}</strong>
            <small>{t.wallpaper.bingWallpapersHint}</small>
          </span>
          <span className="bnt-wall-source-check" aria-hidden>
            {bg.bingEnabled && <IconCheck size={12} />}
          </span>
        </button>
      </div>

      <div className="bnt-divider" />

      {bg.bingEnabled ? (
        bing.permission !== 'granted' ? (
          <div className="bnt-bing-auth">
            <span className="bnt-bing-auth-icon"><IconGlobal size={28} /></span>
            <strong>
              {bing.permission === 'checking'
                ? t.wallpaper.bingChecking
                : t.wallpaper.bingPermissionNeeded}
            </strong>
            {bing.permission === 'missing' && (
              <button
                type="button"
                className="bnt-btn bnt-btn-primary bnt-btn-lg"
                disabled={bingWorking}
                onClick={() => void loadBing()}
              >
                {bingWorking ? t.wallpaper.bingLoading : t.wallpaper.bingGrant}
              </button>
            )}
          </div>
        ) : (
          <div className="bnt-bing-panel">
            {bing.wallpaper ? (
              <div
                className="bnt-bing-preview"
                style={{ backgroundImage: `url("${bing.wallpaper.url}")` }}
                role="img"
                aria-label={bing.wallpaper.name}
              />
            ) : (
              <div className="bnt-bing-preview is-empty">
                {bing.loading || bingWorking ? t.wallpaper.bingLoading : t.wallpaper.bingNoImage}
              </div>
            )}
            <div className="bnt-bing-info">
              {bing.wallpaper && (
                <>
                  <strong>{bing.wallpaper.name}</strong>
                  <span>{bing.wallpaper.copyright}</span>
                  <a href={bing.wallpaper.copyrightLink} target="_blank" rel="noreferrer">
                    {t.wallpaper.bingCopyright} <IconExternal size={13} />
                  </a>
                </>
              )}
              {bing.error && (
                <span className="bnt-error">{t.wallpaper.bingLoadFailed(bing.error)}</span>
              )}
              <div className="bnt-bing-actions">
                {bing.fetchedAt && (
                  <span className="bnt-hint">
                    {t.wallpaper.bingUpdatedAt(new Date(bing.fetchedAt).toLocaleString())}
                  </span>
                )}
                <span className="bnt-spacer" />
                <button
                  type="button"
                  disabled={bing.loading || bingWorking}
                  onClick={() => void ensureBingWallpaper(true)}
                >
                  <IconReset size={13} /> {t.wallpaper.bingRefresh}
                </button>
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={() => setIsSorting(true)}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          draggedAt.current = Date.now()
          setIsSorting(false)
        }}
      >
        <div className="bnt-wall-heading">
          <div className="bnt-group-title">{t.wallpaper.section}</div>
          <div className="bnt-wall-breadcrumb">
            <BreadcrumbDrop
              id={null}
              label={t.wallpaper.allWallpapers}
              onClick={() => {
                setCurrentFolderId(null)
                setVisibleLinked(80)
              }}
            />
            {breadcrumbs.map((folder) => (
              <BreadcrumbDrop
                key={folder.id}
                id={folder.id}
                label={folder.name}
                onClick={() => {
                  setCurrentFolderId(folder.id)
                  setVisibleLinked(80)
                }}
              />
            ))}
          </div>
          <span className="bnt-spacer" />
          <span className="bnt-hint">
            {t.wallpaper.selectedSummary(
              bg.selectedIds.length + bg.selectedFolderIds.length,
              rotationCount,
            )}
          </span>
        </div>

        <div className="bnt-wall-toolbar">
          <button
            type="button"
            aria-label={t.wallpaper.selectAll}
            data-tooltip={t.wallpaper.selectAll}
            disabled={!levelCount || allSelected}
            onClick={selectAll}
          >
            <IconSelectAll size={16} />
          </button>
          <button
            type="button"
            aria-label={t.wallpaper.selectNone}
            data-tooltip={t.wallpaper.selectNone}
            disabled={!levelCount || noneSelected}
            onClick={clearAll}
          >
            <IconSelectNone size={16} />
          </button>
          <span className="bnt-wall-toolbar-sep" />
          {!isLinkedFolder && (
            <>
              <button
                type="button"
                aria-label={t.wallpaper.newFolder}
                data-tooltip={t.wallpaper.newFolder}
                onClick={() => setFolderDraft(folderDraft === null ? '' : null)}
              >
                <IconFolderAdd size={16} />
              </button>
              <button
                type="button"
                aria-label={t.wallpaper.localImage}
                data-tooltip={t.wallpaper.localImage}
                onClick={() => fileRef.current?.click()}
              >
                <IconImageAdd size={16} />
              </button>
              <button
                type="button"
                aria-label={t.wallpaper.imageUrl}
                data-tooltip={t.wallpaper.imageUrl}
                onClick={() => setUrlDraft(urlDraft === null ? 'https://' : null)}
              >
                <IconLink size={16} />
              </button>
              <button
                type="button"
                aria-label={t.wallpaper.makeGradient}
                data-tooltip={t.wallpaper.makeGradient}
                onClick={() => setMakerOpen(true)}
              >
                <IconPalette size={16} />
              </button>
            </>
          )}
          {canLink && (
            <button
              type="button"
              aria-label={supportsDirectoryPicker() ? t.wallpaper.linkDirectory : t.wallpaper.linkUnsupported}
              data-tooltip={supportsDirectoryPicker() ? t.wallpaper.linkDirectory : t.wallpaper.linkUnsupported}
              disabled={working || !supportsDirectoryPicker()}
              onClick={() => void associate()}
            >
              <IconLink size={16} />
            </button>
          )}
          {isLinkedFolder && (
            <>
              <button
                type="button"
                aria-label={currentSource ? t.wallpaper.relink : t.wallpaper.linkOnThisDevice}
                data-tooltip={currentSource ? t.wallpaper.relink : t.wallpaper.linkOnThisDevice}
                disabled={working}
                onClick={() => void associate()}
              >
                <IconLink size={16} />
              </button>
              {currentSource && (
                <button
                  type="button"
                  aria-label={t.wallpaper.refresh}
                  data-tooltip={t.wallpaper.refresh}
                  disabled={working}
                  onClick={() => void refresh()}
                >
                  <IconReset size={16} />
                </button>
              )}
              <button
                type="button"
                aria-label={t.wallpaper.unlink}
                data-tooltip={t.wallpaper.unlink}
                disabled={working}
                onClick={unlink}
              >
                <IconUnlink size={16} />
              </button>
              <span className="bnt-wall-source-meta">
                {currentSource
                  ? currentSource.permission === 'granted'
                    ? t.wallpaper.linked(
                        currentSource.name,
                        currentSource.files.length,
                        new Date(currentSource.scannedAt).toLocaleString(),
                      )
                    : t.wallpaper.linkedNeedsPermission(currentSource.files.length)
                  : t.wallpaper.notLinkedHere}
              </span>
            </>
          )}
          {!isLinkedFolder && (
            <>
              <span className="bnt-spacer" />
              <button
                type="button"
                className="bnt-wall-toolbar-restore"
                aria-label={t.wallpaper.restorePresets}
                data-tooltip={t.wallpaper.restorePresets}
                onClick={restorePresets}
              >
                <IconRestore size={16} />
              </button>
            </>
          )}
        </div>

        {folderDraft !== null && (
          <div className="bnt-input-group bnt-settings-text-input">
            <input
              autoFocus
              value={folderDraft}
              placeholder={t.wallpaper.folderNamePlaceholder}
              onChange={(event) => setFolderDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addFolder()}
            />
            <button type="button" className="bnt-inline-action" onClick={addFolder}>{t.wallpaper.create}</button>
          </div>
        )}
        {urlDraft !== null && (
          <div className="bnt-input-group bnt-settings-text-input">
            <input
              autoFocus
              value={urlDraft}
              placeholder={t.wallpaper.urlPlaceholder}
              onChange={(event) => setUrlDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addUrl(urlDraft)}
            />
            <button type="button" className="bnt-inline-action" onClick={() => addUrl(urlDraft)}>{t.wallpaper.add}</button>
          </div>
        )}

        <div
          className={`bnt-wall-scroll${isSorting ? ' is-sorting' : ''}`}
          onScroll={(event) => {
            const element = event.currentTarget
            if (
              linkedWalls.length > visibleLinked &&
              element.scrollHeight - element.scrollTop - element.clientHeight < 72
            ) {
              setVisibleLinked((value) => Math.min(linkedWalls.length, value + 80))
            }
          }}
        >
          {!!directFolders.length && (
            <section className="bnt-wall-section" aria-label={t.wallpaper.foldersLabel}>
              <div className="bnt-wall-section-label">{t.wallpaper.folders}</div>
              <SortableContext items={folderSortableIds} strategy={rectSortingStrategy}>
                <div className="bnt-wallgrid">
                  {directFolders.map((item) => (
                <SortableFolder
                  key={item.id}
                  folder={item}
                  state={inherited ? 'on' : folderCheckState(bg, item.id)}
                  count={rotationWallpapers({
                    ...settings,
                    background: { ...bg, selectedIds: [], selectedFolderIds: [item.id] },
                  }).length}
                  onOpen={() => {
                    if (Date.now() - draggedAt.current < 250) return
                    setCurrentFolderId(item.id)
                    setVisibleLinked(80)
                  }}
                  onToggle={() => toggleFolder(item.id)}
                  onDelete={() => removeFolder(item)}
                />
                  ))}
                </div>
              </SortableContext>
            </section>
          )}

          {!!visiblePictures.length && (
            <section className="bnt-wall-section" aria-label={t.wallpaper.picturesLabel}>
              <div className="bnt-wall-section-label">{t.wallpaper.pictures}</div>
              <SortableContext items={pictureSortableIds} strategy={rectSortingStrategy}>
                <div className="bnt-wallgrid">
                  {visiblePictures.map((item) => item.kind === 'linked' ? (
                    <SortableLinkedWallpaper
                      key={item.id}
                      wall={item}
                      selected={inherited || bg.selectedIds.includes(item.id)}
                      onToggle={() => toggleWall(item.id)}
                    />
                  ) : (
                    <SortableWallpaper
                      key={item.id}
                      wall={item}
                      selected={inherited || bg.selectedIds.includes(item.id)}
                      onToggle={() => toggleWall(item.id)}
                      onDelete={() => void removeWall(item)}
                    />
                  ))}
                </div>
              </SortableContext>
            </section>
          )}

          {!directFolders.length && !directWalls.length && !linkedWalls.length && (
            <div className="bnt-wall-empty">
              <IconFolderOpen size={28} />
              <span>{isLinkedFolder ? t.wallpaper.emptyLinkedFolder : t.wallpaper.emptyFolder}</span>
            </div>
          )}
          {linkedWalls.length > visibleLinked && (
            <div className="bnt-wall-loading">{t.wallpaper.loadMore}</div>
          )}
        </div>
          </DndContext>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void addLocal(event.target.files?.[0])} />

      <div className="bnt-hint">{t.wallpaper.hint}</div>

      {rotationCount === 0 && (
        <div className="bnt-wall-empty-note">{t.wallpaper.noneSelected}</div>
      )}

          <div className="bnt-divider" />

          <div className="bnt-row">
            <span className="bnt-group-title">{t.wallpaper.rotation}</span>
            <span className="bnt-spacer" />
            <Segmented
              value={bg.rotate}
              options={rotateModes(t)}
              onChange={(rotate) => patchBg({ rotate })}
            />
          </div>

          {bg.rotate !== 'off' && (
            <>
              <NumberSetting
                label={t.wallpaper.interval}
                value={bg.intervalMinutes}
                min={0}
                step={0.5}
                unit={t.wallpaper.intervalUnit}
                onChange={(intervalMinutes) => patchBg({ intervalMinutes })}
              />
              <div className="bnt-hint">{t.wallpaper.intervalHint}</div>
            </>
          )}
          {makerOpen && (
            <GradientMaker
              onClose={() => setMakerOpen(false)}
              onAdd={(wall) => {
                const added = {
                  ...wall,
                  parentId: currentFolderId,
                  order: nextWallpaperOrder(bg.wallpapers, currentFolderId),
                }
                patchBg({
                  wallpapers: [...bg.wallpapers, added],
                  selectedIds: [...bg.selectedIds, added.id],
                })
              }}
            />
          )}
        </>
      )}

    </div>
  )
}
