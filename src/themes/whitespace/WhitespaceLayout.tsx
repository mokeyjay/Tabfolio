import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BookmarkNode, SearchScope } from '../../types'
import { useApp } from '../../app/AppContext'
import { intoId, IntoZone, useDrag } from '../../app/DragProvider'
import { updateSettings } from '../../state/settingsStore'
import { displayDomain } from '../../utils/url'
import { splitLeadingEmoji } from '../../utils/emoji'
import { isMac } from '../../utils/platform'
import { useCardTint } from '../../hooks/useCardTint'
import { hexToRgb } from '../../utils/color'
import { useMessages, type Messages } from '../../i18n'
import { BookmarkIcon } from '../../components/BookmarkIcon'
import { SettingsButton } from '../../components/SettingsButton'
import { SlidingGroup } from '../../components/ui'
import {
  IconClear,
  IconCommand,
  IconFolderOutline,
  IconGlobal,
  IconSearch,
} from '../../components/icons'

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

/** 按唯一路径逐级还原目录，避免重名目录或名称中的斜杠造成误跳转。 */
function folderBreadcrumb(root: BookmarkNode, current: BookmarkNode): BookmarkNode[] {
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

function Clock() {
  const t = useMessages()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return (
    <div className="bnt-whitespace-clock" aria-label={`${time}，${t.theme.whitespaceDate(now)}`}>
      <time dateTime={now.toISOString()}>{time}</time>
      <span>{t.theme.whitespaceDate(now)}</span>
    </div>
  )
}

function Search() {
  const { query, setQuery, settings } = useApp()
  const t = useMessages()
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

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
    <div className="bnt-whitespace-search-wrap">
      <label className={`bnt-whitespace-search${focused ? ' is-focused' : ''}`}>
        <IconSearch size={16} />
        <input
          ref={inputRef}
          value={query}
          placeholder={t.sidebar.searchPlaceholder}
          aria-label={t.sidebar.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            if (query) setQuery('')
            else inputRef.current?.blur()
          }}
        />
        {query ? (
          <button
            type="button"
            aria-label={t.sidebar.clearSearch}
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            <IconClear size={15} />
          </button>
        ) : (
          <span className="bnt-whitespace-kbd" aria-hidden>
            {isMac ? <IconCommand size={11} /> : <span>Ctrl</span>}K
          </span>
        )}
      </label>
      {!!query.trim() && (
        <SlidingGroup
          value={settings.search.scope}
          options={scopeOptions(t)}
          onChange={(scope) =>
            updateSettings((prev) => ({ ...prev, search: { ...prev.search, scope } }))
          }
          className="bnt-scope bnt-whitespace-scope"
          itemClassName="bnt-scope-item"
          role="radiogroup"
          itemRole="radio"
          ariaLabel={t.content.searchScope}
        />
      )}
    </div>
  )
}

function FolderTab({ node }: { node: BookmarkNode }) {
  const { currentFolder, selectFolder, openMenu } = useApp()
  const { setNodeRef, isOver } = useDroppable({
    id: intoId(node, 'whitespace-tab'),
    data: { kind: 'into', node },
  })
  const active =
    currentFolder?.path === node.path || !!currentFolder?.path.startsWith(`${node.path}/`)
  const { label } = splitLeadingEmoji(node.title)

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`bnt-whitespace-tab${active ? ' is-on' : ''}${isOver ? ' is-drop-into' : ''}`}
      onClick={() => selectFolder(node.path)}
      onContextMenu={(event) => openMenu(event, node)}
    >
      {label || node.title}
    </button>
  )
}

function FolderDropZone({ node }: { node: BookmarkNode }) {
  const instance = useId()
  const { setNodeRef, isOver } = useDroppable({
    id: intoId(node, instance),
    data: { kind: 'into', node },
  })
  return (
    <span
      ref={setNodeRef}
      className={`bnt-whitespace-folder-drop${isOver ? ' is-over' : ''}`}
      aria-hidden
    />
  )
}

function FolderLink({ node }: { node: BookmarkNode }) {
  const { selectFolder, openMenu, meta } = useApp()
  const { justDragged } = useDrag()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { kind: 'node', node },
  })
  const { label } = splitLeadingEmoji(node.title)

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform), transition } : undefined}
      className={`bnt-whitespace-folder${isDragging ? ' is-dragging' : ''}`}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!justDragged()) selectFolder(node.path)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        selectFolder(node.path)
      }}
      onContextMenu={(event) => openMenu(event, node)}
    >
      <BookmarkIcon node={node} meta={meta[node.key]} size={15} />
      <span>{label || node.title}</span>
      <small>{node.count}</small>
      <FolderDropZone node={node} />
    </div>
  )
}

function BookmarkRow({ node }: { node: BookmarkNode }) {
  const { settings, meta, open, openMenu } = useApp()
  const { activeNode, justDragged } = useDrag()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: node.id, data: { kind: 'node', node } })
  const { label } = splitLeadingEmoji(node.title)
  // 有图标时复用卡片染色的主色提取；无图标时回到框架级主要颜色。
  const tint = useCardTint(node, meta[node.key], true, hexToRgb(settings.theme.accent))
  const insertAfter =
    !!activeNode && activeNode.parentId === node.parentId && activeNode.index < node.index
  const dropClass =
    isOver && activeNode && activeNode.id !== node.id
      ? insertAfter
        ? ' is-drop-after'
        : ' is-drop-before'
      : ''

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform), transition } : undefined}
      className={`bnt-whitespace-row${isDragging ? ' is-dragging' : ''}${dropClass}`}
      {...attributes}
      {...listeners}
      role="link"
      tabIndex={0}
      title={`${label || node.title}\n${node.url}`}
      onClick={(event) => {
        if (!justDragged()) open(node, event.metaKey || event.ctrlKey)
      }}
      onAuxClick={(event) => {
        if (event.button === 1) {
          event.preventDefault()
          open(node, true)
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        open(node)
      }}
      onContextMenu={(event) => openMenu(event, node)}
    >
      <span
        className="bnt-whitespace-dot"
        style={{ background: tint ? `rgb(${tint})` : settings.theme.accent }}
      />
      <span className="bnt-whitespace-row-title">{label || node.title}</span>
      {settings.display.showDomain && node.url && (
        <span className="bnt-whitespace-domain">{displayDomain(node.url)}</span>
      )}
    </div>
  )
}

function WhitespaceContent({ tabs }: { tabs: BookmarkNode[] }) {
  const { settings, root, currentFolder, selectFolder, query, searchResults, openMenu } = useApp()
  const t = useMessages()
  const searching = !!query.trim()
  const children = currentFolder?.children ?? []
  const bookmarks = searching ? searchResults : children.filter((node) => !!node.url)
  const folders = searching ? [] : children.filter((node) => !node.url)

  const breadcrumbs = useMemo(() => {
    if (!currentFolder || !settings.display.showFolderPath) return []
    const chain = folderBreadcrumb(root, currentFolder)
    const topIndex = chain.findIndex((folder) => tabs.some((tab) => tab.path === folder.path))
    return topIndex >= 0 ? chain.slice(topIndex) : chain
  }, [currentFolder, root, settings.display.showFolderPath, tabs])

  const empty = !bookmarks.length && !folders.length

  return (
    <>
      {breadcrumbs.length > 1 && (
        <nav className="bnt-whitespace-crumbs" aria-label={t.content.bookmarks}>
          {breadcrumbs.map((folder, index) => {
            const { label } = splitLeadingEmoji(folder.title)
            const current = index === breadcrumbs.length - 1
            return (
              <span key={folder.path}>
                {index > 0 && <i aria-hidden>›</i>}
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
      )}

      {currentFolder && (
        <IntoZone node={currentFolder} className="bnt-whitespace-content">
          <SortableContext items={bookmarks.map((node) => node.id)} strategy={rectSortingStrategy}>
            <div className="bnt-whitespace-rows">
              {bookmarks.map((node) => (
                <BookmarkRow key={node.id} node={node} />
              ))}
            </div>
          </SortableContext>

          {!!folders.length && (
            <SortableContext items={folders.map((node) => node.id)} strategy={rectSortingStrategy}>
              <div className="bnt-whitespace-folders">
                {folders.map((node) => (
                  <FolderLink key={node.id} node={node} />
                ))}
              </div>
            </SortableContext>
          )}
        </IntoZone>
      )}

      {empty && (
        <div
          className="bnt-whitespace-empty"
          onContextMenu={(event) => openMenu(event, currentFolder)}
        >
          <strong>{searching ? t.content.emptySearch : t.content.emptyFolder}</strong>
          <span>{searching ? t.content.emptySearchHint : t.content.emptyFolderHint}</span>
        </div>
      )}
    </>
  )
}

/** 留白骨架：时钟、细线搜索、一级目录文字导航与窄栏书签列表。 */
export function WhitespaceLayout() {
  const { root } = useApp()
  const t = useMessages()
  const tabs = useMemo(
    () => (root.children ?? []).flatMap((rootFolder) =>
      (rootFolder.children ?? []).filter((node) => !node.url),
    ),
    [root],
  )

  return (
    <div className="bnt-app bnt-whitespace-layout">
      <div className="bnt-whitespace-stage">
        <Clock />
        <Search />
        {!!tabs.length && (
          <nav className="bnt-whitespace-tabs" aria-label={t.sidebar.folderTree}>
            {tabs.map((node) => (
              <FolderTab key={node.id} node={node} />
            ))}
          </nav>
        )}
        <WhitespaceContent tabs={tabs} />
      </div>

      <div className="bnt-whitespace-actions">
        <SettingsButton />
      </div>
    </div>
  )
}
