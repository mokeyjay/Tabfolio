import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BookmarkNode, SearchScope } from '../../types'
import { useApp } from '../../app/AppContext'
import { intoId, IntoZone, useDrag } from '../../app/DragProvider'
import { updateSettings } from '../../state/settingsStore'
import { displayDomain } from '../../utils/url'
import { splitLeadingEmoji } from '../../utils/emoji'
import { BookmarkIcon } from '../../components/BookmarkIcon'
import { SettingsButton } from '../../components/SettingsButton'
import { SlidingGroup } from '../../components/ui'
import {
  IconChevronRight,
  IconClear,
  IconFolderOutline,
  IconGlobal,
  IconSearch,
} from '../../components/icons'
import { useMessages, type Messages } from '../../i18n'

interface ColumnModel {
  key: string
  widthKey: string
  title: string
  owner: BookmarkNode
  items: BookmarkNode[]
}

/** 用节点唯一定位路径逐级还原当前选中链，避免重名目录跳错列。 */
function folderChain(root: BookmarkNode, current: BookmarkNode | null): BookmarkNode[] {
  if (!current || current.id === root.id) return []
  const chain: BookmarkNode[] = []
  const segments = current.path.split('/').filter(Boolean)
  let children = root.children ?? []
  let path = ''
  for (const segment of segments) {
    path += `/${segment}`
    const folder = children.find((node) => !node.url && node.path === path)
    if (!folder) break
    chain.push(folder)
    children = folder.children ?? []
  }
  return chain
}

function scopeOptions(t: Messages) {
  return [
    {
      value: 'folder' as SearchScope,
      label: (
        <>
          <IconFolderOutline size={13} />
          {t.content.scopeFolder}
        </>
      ),
    },
    {
      value: 'all' as SearchScope,
      label: (
        <>
          <IconGlobal size={13} />
          {t.content.scopeAll}
        </>
      ),
    },
  ]
}

const COLUMN_WIDTH_MIN = 96
const COLUMN_WIDTH_MAX = 800
const COLUMN_WIDTH_STEP = 4
const COLUMN_WIDTH_DEFAULT = 272
const COLUMN_WIDTHS_OPTION = 'columnWidths'

function clampColumnWidth(value: number): number {
  const stepped = Math.round(value / COLUMN_WIDTH_STEP) * COLUMN_WIDTH_STEP
  return Math.min(COLUMN_WIDTH_MAX, Math.max(COLUMN_WIDTH_MIN, stepped))
}

function parseColumnWidths(raw: unknown): Record<string, number> {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const widths: Record<string, number> = {}
    for (const [key, width] of Object.entries(value)) {
      if (typeof width === 'number' && Number.isFinite(width)) {
        widths[key] = clampColumnWidth(width)
      }
    }
    return widths
  } catch {
    return {}
  }
}

/** 每条分隔线只更新所属目录列的主题级宽度，并通过设置存储跨会话记忆。 */
function ColumnResizeHandle({ widthKey, width }: { widthKey: string; width: number }) {
  const t = useMessages()
  const cleanupDrag = useRef<(() => void) | null>(null)
  const [resizing, setResizing] = useState(false)

  const setWidth = (nextWidth: number) => {
    const columnWidth = clampColumnWidth(nextWidth)
    updateSettings((prev) => {
      const currentOptions = prev.theme.options.columns
      const widths = parseColumnWidths(currentOptions?.[COLUMN_WIDTHS_OPTION])
      if (widths[widthKey] === columnWidth) return prev
      return {
        ...prev,
        theme: {
          ...prev.theme,
          options: {
            ...prev.theme.options,
            columns: {
              // 第一次拖动前可能还没有列栏配置，顺便补齐主题默认值。
              tone: 'cool',
              transparency: 12,
              ...currentOptions,
              [COLUMN_WIDTHS_OPTION]: JSON.stringify({ ...widths, [widthKey]: columnWidth }),
            },
          },
        },
      }
    })
  }

  useEffect(() => () => cleanupDrag.current?.(), [])

  const finish = () => {
    setResizing(false)
    cleanupDrag.current?.()
    cleanupDrag.current = null
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    setWidth(
      width + (event.key === 'ArrowRight' ? COLUMN_WIDTH_STEP : -COLUMN_WIDTH_STEP),
    )
  }

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startWidth = width
    setResizing(true)

    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      moveEvent.preventDefault()
      setWidth(startWidth + moveEvent.clientX - startX)
    }
    const stop = (stopEvent: PointerEvent) => {
      if (stopEvent.pointerId === pointerId) finish()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    cleanupDrag.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }

  return (
    <div
      className={`bnt-columns-resizer${resizing ? ' is-resizing' : ''}`}
      role="separator"
      tabIndex={0}
      aria-label={t.theme.columnsResize}
      aria-orientation="vertical"
      aria-valuemin={COLUMN_WIDTH_MIN}
      aria-valuemax={COLUMN_WIDTH_MAX}
      aria-valuenow={width}
      title={t.theme.columnsResizeHint}
      onKeyDown={onKeyDown}
      onPointerDown={startResize}
    />
  )
}

function FolderDropTarget({ node }: { node: BookmarkNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: intoId(node, `columns-row-${node.id}`),
    data: { kind: 'into', node },
  })
  return (
    <span
      ref={setNodeRef}
      className={`bnt-columns-row-drop${isOver ? ' is-over' : ''}`}
      aria-hidden
    />
  )
}

function ColumnRow({ node, selected }: { node: BookmarkNode; selected: boolean }) {
  const { settings, meta, selectFolder, open, openMenu } = useApp()
  const { activeNode, justDragged } = useDrag()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: node.id, data: { kind: 'node', node } })
  const folder = !node.url
  const { label } = splitLeadingEmoji(node.title)
  const insertAfter =
    !!activeNode && activeNode.parentId === node.parentId && activeNode.index < node.index
  const dropClass =
    isOver && activeNode && activeNode.id !== node.id
      ? insertAfter
        ? ' is-drop-after'
        : ' is-drop-before'
      : ''

  const activate = () => {
    if (folder) selectFolder(node.path)
    else open(node)
  }

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform), transition } : undefined}
      className={`bnt-columns-row${selected ? ' is-selected' : ''}${
        isDragging ? ' is-dragging' : ''
      }${dropClass}`}
      {...attributes}
      {...listeners}
      role={folder ? 'button' : 'link'}
      tabIndex={0}
      aria-current={selected ? 'true' : undefined}
      title={folder ? label || node.title : `${label || node.title}\n${node.url}`}
      onClick={() => {
        if (!justDragged()) activate()
      }}
      onAuxClick={(event) => {
        if (!folder && event.button === 1) {
          event.preventDefault()
          open(node, true)
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        activate()
      }}
      onContextMenu={(event) => openMenu(event, node)}
    >
      <BookmarkIcon node={node} meta={meta[node.key]} size={20} folderOpen={folder && selected} />
      <span className="bnt-columns-row-title">{label || node.title}</span>
      {folder ? (
        <IconChevronRight size={16} />
      ) : settings.display.showDomain && node.url ? (
        <span className="bnt-columns-domain">{displayDomain(node.url)}</span>
      ) : null}
      {folder && <FolderDropTarget node={node} />}
    </div>
  )
}

function Column({
  model,
  selectedPaths,
  width,
}: {
  model: ColumnModel
  selectedPaths: Set<string>
  width: number
}) {
  const { openMenu } = useApp()
  const t = useMessages()
  return (
    <section
      className="bnt-columns-column"
      aria-label={model.title}
      style={{ '--bnt-column-w': `${width}px` } as CSSProperties}
    >
      <header className="bnt-columns-column-head">
        <strong title={model.title}>{model.title}</strong>
        <span>{model.items.length}</span>
      </header>
      <IntoZone node={model.owner} className="bnt-columns-column-body">
        <SortableContext
          items={model.items.map((node) => node.id)}
          strategy={verticalListSortingStrategy}
        >
          {model.items.map((node) => (
            <ColumnRow key={node.id} node={node} selected={selectedPaths.has(node.path)} />
          ))}
        </SortableContext>
        {!model.items.length && (
          <div
            className="bnt-columns-empty"
            onContextMenu={(event) => openMenu(event, model.owner)}
          >
            {t.content.emptyFolder}
          </div>
        )}
      </IntoZone>
      <ColumnResizeHandle widthKey={model.widthKey} width={width} />
    </section>
  )
}

function SearchColumn() {
  const { query, searchResults } = useApp()
  const t = useMessages()
  return (
    <section className="bnt-columns-column is-search" aria-label={t.content.searchTitle(query)}>
      <header className="bnt-columns-column-head">
        <strong>{t.content.searchTitle(query)}</strong>
        <span>{searchResults.length}</span>
      </header>
      <div className="bnt-columns-column-body">
        <SortableContext
          items={searchResults.map((node) => node.id)}
          strategy={verticalListSortingStrategy}
        >
          {searchResults.map((node) => (
            <ColumnRow key={node.id} node={node} selected={false} />
          ))}
        </SortableContext>
        {!searchResults.length && (
          <div className="bnt-columns-search-empty">
            <strong>{t.content.emptySearch}</strong>
            <span>{t.content.emptySearchHint}</span>
          </div>
        )}
      </div>
    </section>
  )
}

function ColumnsSearch() {
  const { query, setQuery, settings } = useApp()
  const t = useMessages()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="bnt-columns-search-wrap">
      {!!query.trim() && (
        <SlidingGroup
          value={settings.search.scope}
          options={scopeOptions(t)}
          onChange={(scope) =>
            updateSettings((prev) => ({ ...prev, search: { ...prev.search, scope } }))
          }
          className="bnt-scope bnt-columns-scope"
          itemClassName="bnt-scope-item"
          role="radiogroup"
          itemRole="radio"
          ariaLabel={t.content.searchScope}
        />
      )}
      <label className="bnt-columns-search">
        <IconSearch size={15} />
        <input
          ref={inputRef}
          value={query}
          placeholder={t.sidebar.searchPlaceholder}
          aria-label={t.sidebar.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            if (query) setQuery('')
            else inputRef.current?.blur()
          }}
        />
        {!!query && (
          <button
            type="button"
            aria-label={t.sidebar.clearSearch}
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            <IconClear size={14} />
          </button>
        )}
      </label>
    </div>
  )
}

/** 列栏骨架：每一级目录展开成一列，始终保留祖先上下文。 */
export function ColumnsLayout() {
  const { settings, root, currentFolder, selectFolder, query } = useApp()
  const t = useMessages()
  const railRef = useRef<HTMLDivElement>(null)
  const chain = useMemo(() => folderChain(root, currentFolder), [root, currentFolder])
  const selectedPaths = useMemo(() => new Set(chain.map((node) => node.path)), [chain])
  const columnWidths = useMemo(
    () => parseColumnWidths(settings.theme.options.columns?.[COLUMN_WIDTHS_OPTION]),
    [settings.theme.options.columns],
  )
  const columns = useMemo<ColumnModel[]>(() => {
    const out: ColumnModel[] = [
      {
        key: `root-${root.id}`,
        widthKey: '__root__',
        title: t.content.allFolders,
        owner: root,
        items: root.children ?? [],
      },
    ]
    for (const folder of chain) {
      const { label } = splitLeadingEmoji(folder.title)
      out.push({
        key: folder.path,
        widthKey: folder.key,
        title: label || folder.title,
        owner: folder,
        items: folder.children ?? [],
      })
    }
    return out
  }, [chain, root, t.content.allFolders])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const rail = railRef.current
      if (!rail) return
      rail.scrollTo({ left: rail.scrollWidth, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [currentFolder?.path, query])

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        rail.scrollTo({ left: rail.scrollWidth, behavior: 'auto' })
      })
    })
    observer.observe(rail)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  const visibleCrumbs = settings.display.showFolderPath
    ? chain
    : chain.length
      ? chain.slice(-1)
      : []

  return (
    <div className="bnt-app bnt-columns-layout">
      <div className="bnt-columns-shell">
        <header className="bnt-columns-toolbar">
          <button
            type="button"
            className="bnt-columns-brand"
            onClick={() => selectFolder(root.path)}
          >
            {t.theme.columnsBrand}
          </button>
          <nav className="bnt-columns-crumbs" aria-label={t.content.bookmarks}>
            {visibleCrumbs.map((folder, index) => {
              const { label } = splitLeadingEmoji(folder.title)
              const current = index === visibleCrumbs.length - 1
              return (
                <span key={folder.path}>
                  {(settings.display.showFolderPath || index > 0) && <i aria-hidden>›</i>}
                  <button
                    type="button"
                    aria-current={current ? 'page' : undefined}
                    onClick={() => selectFolder(folder.path)}
                  >
                    {label || folder.title}
                  </button>
                </span>
              )
            })}
          </nav>
          <ColumnsSearch />
          <SettingsButton />
        </header>

        <main ref={railRef} className="bnt-columns-rail">
          {query.trim() ? (
            <SearchColumn />
          ) : (
            columns.map((column) => (
              <Column
                key={column.key}
                model={column}
                selectedPaths={selectedPaths}
                width={columnWidths[column.widthKey] ?? COLUMN_WIDTH_DEFAULT}
              />
            ))
          )}
        </main>
      </div>
    </div>
  )
}
