import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BookmarkNode, SearchScope } from '../../types'
import { useApp } from '../../app/AppContext'
import { IntoZone, useDrag } from '../../app/DragProvider'
import { BookmarkIcon } from '../../components/BookmarkIcon'
import { DisplaySettingsPopover } from '../../components/DisplaySettingsPopover'
import { SlidingGroup } from '../../components/ui'
import {
  IconClear,
  IconFolderOutline,
  IconGlobal,
  IconSearch,
  IconSettings,
} from '../../components/icons'
import { updateSettings } from '../../state/settingsStore'
import { displayDomain } from '../../utils/url'
import { splitLeadingEmoji } from '../../utils/emoji'
import { useMessages, type Messages } from '../../i18n'

interface SectionModel {
  folder: BookmarkNode
  label: string
  emoji: string | null
  parentPath: string
  items: BookmarkNode[]
}

/** 把目录树摊成栏目，同时保留足够区分同名目录的祖先路径 */
function collectSections(nodes: BookmarkNode[], ancestors: string[] = []): SectionModel[] {
  const sections: SectionModel[] = []
  for (const folder of nodes) {
    if (folder.url) continue
    const { emoji, label } = splitLeadingEmoji(folder.title)
    const children = folder.children ?? []
    const folders = children.filter((node) => !node.url)
    const items = children.filter((node) => !!node.url)

    // 有直接书签的目录一定成栏；空的末级目录也保留，方便接收拖入和右键管理。
    if (items.length || !folders.length) {
      sections.push({
        folder,
        label: label || folder.title,
        emoji,
        parentPath: ancestors.join(' › '),
        items,
      })
    }

    // 浏览器的顶层根目录（书签栏、其他书签）不塞进路径，避免每栏都重复同一层。
    const nextAncestors = folder.depth === 0 ? [] : [...ancestors, label || folder.title]
    sections.push(...collectSections(folders, nextAncestors))
  }
  return sections
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

function ColumnarSearch() {
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
    <div className="bnt-columnar-search-wrap">
      {!!query.trim() && (
        <SlidingGroup
          value={settings.search.scope}
          options={scopeOptions(t)}
          onChange={(scope) =>
            updateSettings((prev) => ({ ...prev, search: { ...prev.search, scope } }))
          }
          className="bnt-scope bnt-columnar-scope"
          itemClassName="bnt-scope-item"
          role="radiogroup"
          itemRole="radio"
          ariaLabel={t.content.searchScope}
        />
      )}
      <label className="bnt-columnar-search">
        <IconSearch size={14} />
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

function ColumnarRow({ node }: { node: BookmarkNode }) {
  const { settings, meta, open, openMenu } = useApp()
  const { activeNode, justDragged } = useDrag()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: node.id, data: { kind: 'node', node } })
  const insertAfter =
    !!activeNode && activeNode.parentId === node.parentId && activeNode.index < node.index
  const dropClass =
    isOver && activeNode && activeNode.id !== node.id
      ? insertAfter
        ? ' is-drop-after'
        : ' is-drop-before'
      : ''
  const { label } = splitLeadingEmoji(node.title)

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform), transition } : undefined}
      className={`bnt-columnar-row${isDragging ? ' is-dragging' : ''}${dropClass}`}
      {...attributes}
      {...listeners}
      role="link"
      tabIndex={0}
      title={`${label || node.title}\n${node.url ?? ''}`}
      onClick={() => {
        if (!justDragged()) open(node)
      }}
      onAuxClick={(event) => {
        if (event.button !== 1) return
        event.preventDefault()
        open(node, true)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        open(node)
      }}
      onContextMenu={(event) => openMenu(event, node)}
    >
      <BookmarkIcon node={node} meta={meta[node.key]} size={18} />
      <span className="bnt-columnar-row-title">{label || node.title}</span>
      {settings.display.showDomain && node.url && (
        <span className="bnt-columnar-domain">{displayDomain(node.url)}</span>
      )}
    </div>
  )
}

function ColumnarSection({ model, rows }: { model: SectionModel; rows: number }) {
  const { currentFolder, openMenu, selectFolder } = useApp()
  const t = useMessages()
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? model.items : model.items.slice(0, rows)
  const active = currentFolder?.path === model.folder.path

  return (
    <section className="bnt-columnar-section" aria-label={model.label}>
      <header
        className="bnt-columnar-section-head"
        onContextMenu={(event) => openMenu(event, model.folder)}
      >
        {model.emoji && <span className="bnt-columnar-section-emoji">{model.emoji}</span>}
        {model.parentPath && (
          <span className="bnt-columnar-section-path" title={model.parentPath}>
            {model.parentPath}
          </span>
        )}
        <button
          type="button"
          className="bnt-columnar-section-name"
          aria-current={active ? 'true' : undefined}
          onClick={() => selectFolder(model.folder.path)}
        >
          {model.label}
        </button>
        <span className="bnt-columnar-section-count">{model.items.length}</span>
      </header>

      <IntoZone node={model.folder} className="bnt-columnar-section-body">
        <SortableContext
          items={shown.map((node) => node.id)}
          strategy={verticalListSortingStrategy}
        >
          {shown.map((node) => <ColumnarRow key={node.id} node={node} />)}
        </SortableContext>
        {!model.items.length && (
          <div className="bnt-columnar-empty">{t.content.emptyFolder}</div>
        )}
      </IntoZone>

      {model.items.length > rows && (
        <button
          type="button"
          className="bnt-columnar-more"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t.theme.columnarCollapse : t.theme.columnarExpandAll(model.items.length)}
        </button>
      )}
    </section>
  )
}

function SearchSection({ items, query }: { items: BookmarkNode[]; query: string }) {
  const t = useMessages()
  return (
    <section className="bnt-columnar-section is-search" aria-label={t.content.searchTitle(query)}>
      <header className="bnt-columnar-section-head">
        <span className="bnt-columnar-section-name">{t.content.searchTitle(query)}</span>
        <span className="bnt-columnar-section-count">{items.length}</span>
      </header>
      <div className="bnt-columnar-section-body">
        <SortableContext items={items.map((node) => node.id)} strategy={verticalListSortingStrategy}>
          {items.map((node) => <ColumnarRow key={node.id} node={node} />)}
        </SortableContext>
        {!items.length && (
          <div className="bnt-columnar-search-empty">
            <strong>{t.content.emptySearch}</strong>
            <span>{t.content.emptySearchHint}</span>
          </div>
        )}
      </div>
    </section>
  )
}

/** 分栏骨架：把每个目录的直属书签摊成报刊式栏目 */
export function ColumnarLayout() {
  const { settings, root, query, searchResults, selectFolder, setSettingsOpen } = useApp()
  const t = useMessages()
  const options = settings.theme.options.columnar
  const rows = Math.min(12, Math.max(4, Number(options?.rows ?? 6)))
  const sections = useMemo(() => collectSections(root.children ?? []), [root])

  return (
    <div className="bnt-app bnt-columnar-layout">
      <div className="bnt-columnar-shell">
        <header className="bnt-columnar-toolbar">
          <button
            type="button"
            className="bnt-columnar-brand"
            onClick={() => selectFolder(root.path)}
          >
            {t.theme.columnarBrand}
          </button>
          <span className="bnt-columnar-total">{t.sidebar.total(root.count)}</span>
          <span className="bnt-columnar-toolbar-spacer" />
          <ColumnarSearch />
          <DisplaySettingsPopover />
          <button
            type="button"
            className="bnt-iconbtn bnt-columnar-settings"
            title={t.sidebar.settings}
            aria-label={t.sidebar.settings}
            onClick={() => setSettingsOpen(true)}
          >
            <IconSettings size={16} />
          </button>
        </header>

        <main className="bnt-columnar-main">
          <div className={`bnt-columnar-flow${query.trim() ? ' is-search' : ''}`}>
            {query.trim() ? (
              <SearchSection items={searchResults} query={query} />
            ) : (
              sections.map((section) => (
                <ColumnarSection key={section.folder.key} model={section} rows={rows} />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
