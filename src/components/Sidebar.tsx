import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { BookmarkNode } from '../types'
import { useApp } from '../app/AppContext'
import { intoId } from '../app/DragProvider'
import { collectBookmarks } from '../platform/bookmarks'
import { useAutoHeight } from '../hooks/useAutoHeight'
import { useResizable } from '../hooks/useResizable'
import { updateSettings } from '../state/settingsStore'
import { SIDEBAR_MAX, SIDEBAR_MIN } from '../state/settingsSchema'
import { splitLeadingEmoji } from '../utils/emoji'
import { isMac } from '../utils/platform'
import { useMessages } from '../i18n'
import { BookmarkIcon } from './BookmarkIcon'
import {
  IconChevronLeft,
  IconChevronRight,
  IconClear,
  IconCommand,
  IconPin,
  IconSearch,
} from './icons'

function FolderRow({ node }: { node: BookmarkNode }) {
  const dropInstance = useId()
  const {
    currentFolder,
    selectFolder,
    expanded,
    setExpandedOpen,
    toggleExpanded,
    openMenu,
    settings,
    meta,
  } = useApp()
  const t = useMessages()

  const subFolders = (node.children ?? []).filter((c) => !c.url)
  const isOpen = expanded.has(node.path)
  const isActive = currentFolder?.path === node.path
  const isPinned = settings.selection.pinnedFolderPath === node.path
  const { label } = splitLeadingEmoji(node.title)

  const { setNodeRef, isOver } = useDroppable({
    id: intoId(node, dropInstance),
    data: { kind: 'into', node },
  })
  const childrenRef = useAutoHeight<HTMLDivElement>(isOpen)

  return (
    <>
      <button
        ref={setNodeRef}
        type="button"
        className={`bnt-tree-item${isActive ? ' is-active' : ''}${
          isOver ? ' is-drop-into' : ''
        }`}
        style={{ paddingLeft: 8 + node.depth * 13 }}
        // 单击即打开：选中该目录，同时展开它的子目录
        onClick={() => {
          selectFolder(node.path)
          if (subFolders.length) setExpandedOpen(node.path, isActive ? !isOpen : true)
        }}
        onContextMenu={(e) => openMenu(e, node)}
      >
        <span
          role="presentation"
          className={`bnt-tree-twisty${isOpen ? ' is-open' : ''}${
            subFolders.length ? '' : ' is-leaf'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(node.path)
          }}
        >
          <IconChevronRight size={15} />
        </span>
        <BookmarkIcon node={node} meta={meta[node.key]} size={20} folderOpen={isOpen} />
        <span className="bnt-tree-name">{label || t.common.untitled}</span>
        {isPinned && (
          <span className="bnt-tree-pin" title={t.sidebar.pinned}>
            <IconPin size={13} />
          </span>
        )}
        <span className="bnt-tree-count">{node.count}</span>
      </button>
      <div ref={childrenRef} className="bnt-tree-children">
        {isOpen && subFolders.map((f) => <FolderRow key={f.id} node={f} />)}
      </div>
    </>
  )
}

/** ⌘K / Ctrl+K —— macOS 用命令键图标，其余平台写 Ctrl */
function SearchShortcut() {
  return (
    <span className="bnt-search-kbd" aria-label={isMac ? 'Command K' : 'Control K'}>
      {isMac ? <IconCommand size={12} /> : <span className="bnt-kbd-text">Ctrl</span>}K
    </span>
  )
}

export function Sidebar() {
  const { root, query, setQuery, settings } = useApp()
  const t = useMessages()
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  const total = useMemo(() => collectBookmarks(root).length, [root])

  const commitWidth = useCallback((width: number) => {
    updateSettings((p) => ({ ...p, sidebar: { ...p.sidebar, width } }))
  }, [])
  const resize = useResizable({
    value: settings.sidebar.width,
    min: SIDEBAR_MIN,
    max: SIDEBAR_MAX,
    onCommit: commitWidth,
  })

  // ⌘K / Ctrl+K 聚焦搜索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const topFolders = (root.children ?? []).filter((c) => !c.url)
  const collapsed = !settings.sidebar.leftOpen

  return (
    <aside
      className={`bnt-panel bnt-sidebar${resize.dragging ? ' is-resizing' : ''}${
        collapsed ? ' is-collapsed' : ''
      }`}
      aria-hidden={collapsed}
      style={{
        width: resize.width,
        marginLeft: collapsed ? -(resize.width + 14) : 0,
      }}
    >
      <div className={`bnt-search${focused ? ' is-focused' : ''}`}>
        <IconSearch className="bnt-search-icon" size={17} />
        <input
          ref={inputRef}
          value={query}
          placeholder={t.sidebar.searchPlaceholder}
          aria-label={t.sidebar.searchPlaceholder}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              if (query) setQuery('')
              else inputRef.current?.blur()
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="bnt-search-clear"
            aria-label={t.sidebar.clearSearch}
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            <IconClear size={16} />
          </button>
        ) : (
          <SearchShortcut />
        )}
      </div>

      <nav className="bnt-tree" aria-label={t.sidebar.folderTree}>
        {topFolders.map((f) => (
          <FolderRow key={f.id} node={f} />
        ))}
      </nav>

      <div className="bnt-sidebar-foot">
        <span className="bnt-brand-mark" aria-hidden>
          {/* 与 scripts/gen-icons.mjs 的扩展图标同一个书签丝带，底色跟随主题主色 */}
          <svg viewBox="0 0 100 100">
            <polygon points="34,23.5 66,23.5 66,77.5 50,60 34,77.5" fill="currentColor" />
          </svg>
        </span>
        <span className="bnt-brand-text">
          <span className="bnt-brand-name">{t.sidebar.brand}</span>
          <span className="bnt-brand-meta">{t.sidebar.total(total)}</span>
        </span>
        <button
          type="button"
          className="bnt-iconbtn"
          title={t.sidebar.collapse}
          aria-label={t.sidebar.collapse}
          onClick={() =>
            updateSettings((prev) => ({
              ...prev,
              sidebar: { ...prev.sidebar, leftOpen: false },
            }))
          }
        >
          <IconChevronLeft size={17} />
        </button>
      </div>

      <div
        className="bnt-resizer"
        role="separator"
        aria-label={t.sidebar.resize}
        aria-orientation="vertical"
        onPointerDown={resize.onPointerDown}
        onDoubleClick={() => commitWidth(252)}
        title={t.sidebar.resizeHint}
      />
    </aside>
  )
}
