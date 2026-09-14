import { useState, type ReactNode } from 'react'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BookmarkNode, FolderDisplaySetting } from '../types'
import { useApp } from '../app/AppContext'
import { IntoZone, useDrag } from '../app/DragProvider'
import { useColumns } from '../hooks/useColumns'
import { useAutoHeight } from '../hooks/useAutoHeight'
import { MAX_FOLDER_DEPTH } from '../state/settingsSchema'
import { splitLeadingEmoji } from '../utils/emoji'
import { BookmarkCard } from './BookmarkCard'
import { BookmarkIcon } from './BookmarkIcon'
import { IconChevronDown, IconDrag } from './icons'
import { useMessages } from '../i18n'

const HIDDEN: FolderDisplaySetting = { mode: 'hidden', expandAll: false, rows: 2, child: null }

/** 预算为无限 —— 顶层内容区不做行数截断 */
const NO_LIMIT = Number.POSITIVE_INFINITY

/** 把子节点按「连续的书签」和「单个目录」切成段，供「展开」方案逐段渲染 */
type Run =
  | { type: 'cards'; items: BookmarkNode[] }
  | { type: 'folder'; node: BookmarkNode }

function buildRuns(children: BookmarkNode[]): Run[] {
  const runs: Run[] = []
  for (const child of children) {
    if (child.url) {
      const last = runs[runs.length - 1]
      if (last?.type === 'cards') last.items.push(child)
      else runs.push({ type: 'cards', items: [child] })
    } else {
      runs.push({ type: 'folder', node: child })
    }
  }
  return runs
}

/**
 * 按某个展示方案渲染一个目录的内容。
 *
 * 它调用自己来渲染子目录的内容，每一层用的是 `setting.child`，所以「在展开的
 * 目录里继续展开子目录」只是配置里多套一层，渲染逻辑不需要任何特判。
 */
export function FolderContents({
  folder,
  setting,
  depth,
  budget = NO_LIMIT,
}: {
  folder: BookmarkNode
  setting: FolderDisplaySetting
  depth: number
  /** 可显示的书签数上限(行数 × 列数)。目录区块不占预算。 */
  budget?: number
}) {
  const t = useMessages()
  const children = folder.children ?? []
  const bookmarks = children.filter((c) => c.url)
  const folders = children.filter((c) => !c.url)

  if (setting.mode === 'hidden') {
    return <Grid items={bookmarks.slice(0, budget)} />
  }

  if (setting.mode === 'default') {
    // 目录就是列表里的普通一项，除了图标是目录之外没有任何不同
    return <Grid items={children.slice(0, budget)} />
  }

  if (setting.mode === 'pinned') {
    // 目录挑出来独占最顶端一块横向空间
    let left = budget
    const strip = folders.slice(0, left)
    left -= strip.length
    return (
      <>
        {!!strip.length && (
          <div className="bnt-group" style={{ gap: 6 }}>
            <div className="bnt-section-label">{t.content.folders}</div>
            <Grid items={strip} className="bnt-pinned-strip" />
          </div>
        )}
        <Grid items={bookmarks.slice(0, Math.max(0, left))} />
      </>
    )
  }

  // mode === 'expanded'
  const childSetting = depth + 1 >= MAX_FOLDER_DEPTH ? HIDDEN : (setting.child ?? HIDDEN)
  const runs = buildRuns(children)
  const out: ReactNode[] = []
  let left = budget

  for (const [i, run] of runs.entries()) {
    if (run.type === 'cards') {
      if (left <= 0) continue
      const items = run.items.slice(0, left)
      left -= items.length
      out.push(<Grid key={`c${i}`} items={items} />)
    } else {
      // 行数预算只约束书签（「展开」方案收起时露出的是目录里的几行书签），展开的子目录照常渲染 ——
      // 否则子目录区块会把预算吃光，父目录自己的书签一个都露不出来。
      out.push(
        <FolderBlock
          key={run.node.id}
          folder={run.node}
          setting={setting}
          childSetting={childSetting}
          depth={depth + 1}
        />,
      )
    }
  }

  return <>{out}</>
}

function Grid({ items, className = 'bnt-grid' }: { items: BookmarkNode[]; className?: string }) {
  if (!items.length) return null
  return (
    <SortableContext items={items.map((n) => n.id)} strategy={rectSortingStrategy}>
      <div className={className}>
        {items.map((n) => (
          <BookmarkCard key={n.id} node={n} />
        ))}
      </div>
    </SortableContext>
  )
}

/**
 * 「展开」方案里的一个目录：独占一整条横向区域，头部是夹名/数量/展开按钮，
 * 下面默认露出 setting.rows 行内容。
 *
 * 落点分工：头部只认「重排这个区块」，内容区认「放进这个目录」，内容区里的卡片
 * 认精确排序 —— 三层嵌套由碰撞检测按面积挑最内层的那个。
 */
function FolderBlock({
  folder,
  setting,
  childSetting,
  depth,
}: {
  folder: BookmarkNode
  setting: FolderDisplaySetting
  childSetting: FolderDisplaySetting
  depth: number
}) {
  const { settings, selectFolder, openMenu, meta } = useApp()
  const t = useMessages()
  const { activeNode } = useDrag()
  const [colsRef, cols] = useColumns(settings.layout.cardWidth)
  const [expanded, setExpanded] = useState(setting.expandAll)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: folder.id, data: { kind: 'node', node: folder } })

  const budget = expanded ? NO_LIMIT : Math.max(1, setting.rows) * cols
  const visibleTotal = countVisible(folder, childSetting)
  const truncated = !expanded && visibleTotal > budget
  const bodyRef = useAutoHeight<HTMLDivElement>(expanded)
  const { label } = splitLeadingEmoji(folder.title)
  const isEmpty = (folder.children ?? []).length === 0

  return (
    <section
      ref={setNodeRef}
      // 同 BookmarkCard：不在挪动时别把 sortable 的空过渡内联下来
      style={transform ? { transform: CSS.Translate.toString(transform), transition } : undefined}
      className={`bnt-folder-block${isDragging ? ' is-dragging' : ''}`}
      onContextMenu={(e) => openMenu(e, folder)}
    >
      <header className="bnt-folder-head">
        <button
          type="button"
          className="bnt-drag-handle"
          aria-label={t.content.dragToSort}
          {...attributes}
          {...listeners}
        >
          <IconDrag size={15} />
        </button>
        <BookmarkIcon node={folder} meta={meta[folder.key]} size={20} />
        <button
          type="button"
          className="bnt-folder-name"
          title={t.content.openFolder(label)}
          onClick={() => selectFolder(folder.path)}
        >
          {label || t.common.untitled}
        </button>
        <span className="bnt-folder-count">{folder.count}</span>
        <span className="bnt-spacer" />
        {(truncated || expanded) && (
          <button
            type="button"
            className={`bnt-folder-toggle${expanded ? ' is-open' : ''}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? t.content.collapse : t.content.expandAll(visibleTotal)}
            <IconChevronDown size={14} />
          </button>
        )}
      </header>
      <div ref={bodyRef}>
        <IntoZone node={folder} className="bnt-folder-body">
          <div ref={colsRef} className="bnt-folder-children">
            <FolderContents
              folder={folder}
              setting={childSetting}
              depth={depth}
              budget={budget}
            />
            {isEmpty && (
              <div className="bnt-drop-placeholder">
                {activeNode ? t.content.dropHere : t.content.emptyDropTarget}
              </div>
            )}
          </div>
        </IntoZone>
      </div>
    </section>
  )
}

/**
 * 在给定展示方案下，这个目录里有多少项会受行数预算约束 —— 决定要不要给「展开全部」。
 * hidden 和 expanded 下目录不占预算(前者不显示，后者独占区块)，只数书签。
 */
function countVisible(folder: BookmarkNode, setting: FolderDisplaySetting): number {
  const children = folder.children ?? []
  if (setting.mode === 'hidden' || setting.mode === 'expanded') {
    return children.filter((c) => c.url).length
  }
  return children.length
}

/** 内容区顶层：不做行数截断，子目录区块自己测量各自的列数 */
export function FolderContentsRoot({
  folder,
  setting,
}: {
  folder: BookmarkNode
  setting: FolderDisplaySetting
}) {
  return (
    <div className="bnt-folder-children">
      <FolderContents folder={folder} setting={setting} depth={0} />
    </div>
  )
}

export { Grid }
