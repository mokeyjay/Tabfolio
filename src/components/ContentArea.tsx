import type { BookmarkNode, SearchScope } from '../types'
import { useApp } from '../app/AppContext'
import { IntoZone } from '../app/DragProvider'
import { updateSettings } from '../state/settingsStore'
import { splitLeadingEmoji } from '../utils/emoji'
import { FolderContentsRoot, Grid } from './FolderContents'
import { SlidingGroup } from './ui'
import { IconFolderOutline, IconGlobal, IconHome } from './icons'
import { DisplaySettingsPopover } from './DisplaySettingsPopover'
import { useMessages, type Messages } from '../i18n'

/** 按唯一定位路径逐级还原祖先目录，避免重名目录或标题中的斜杠造成误跳转。 */
function folderBreadcrumb(root: BookmarkNode, current: BookmarkNode): BookmarkNode[] {
  const chain: BookmarkNode[] = []
  const pathSegments = current.path.split('/').filter(Boolean)
  let children = root.children ?? []
  let path = ''
  for (const segment of pathSegments) {
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
          <IconFolderOutline size={14} />
          {t.content.scopeFolder}
        </>
      ),
    },
    {
      value: 'all' as SearchScope,
      label: (
        <>
          <IconGlobal size={14} />
          {t.content.scopeAll}
        </>
      ),
    },
  ]
}

export function ContentArea() {
  const { settings, root, currentFolder, selectFolder, query, searchResults, openMenu } = useApp()
  const t = useMessages()

  const searching = !!query.trim()
  const folderLabel = currentFolder ? splitLeadingEmoji(currentFolder.title).label : ''
  const breadcrumbs = currentFolder ? folderBreadcrumb(root, currentFolder) : []
  const pathSegments = breadcrumbs.map((folder) =>
    splitLeadingEmoji(folder.title).label || folder.title,
  )
  const showPath = !searching && settings.display.showFolderPath && !!currentFolder
  const rootChildren = root.children ?? []
  const topFolders = rootChildren.filter((node) => !node.url)
  const firstTopFolder = topFolders[0]
  const hasMultipleRoots = topFolders.length > 1
  const showingSuperRoot = currentFolder?.id === root.id
  const homeTarget = hasMultipleRoots ? root : firstTopFolder
  const pathTitle = breadcrumbs.length
    ? pathSegments.join(' / ')
    : t.content.allFolders

  const title = searching
    ? t.content.searchTitle(query.trim())
    : showingSuperRoot ? t.content.allFolders : folderLabel || t.content.bookmarks

  const count = searching
    ? t.content.resultCount(searchResults.length)
    : t.content.bookmarkCount(currentFolder?.count ?? 0)

  const empty = searching
    ? searchResults.length === 0
    : !currentFolder || (currentFolder.children ?? []).length === 0

  return (
    <main className="bnt-main">
      <div className="bnt-content">
        <header className="bnt-header">
          <div className="bnt-title-row">
            {showPath && (
              <button
                type="button"
                className="bnt-title-home"
                title={hasMultipleRoots ? t.content.backToAll : t.content.backToTop}
                aria-label={hasMultipleRoots ? t.content.backToAll : t.content.backToTop}
                onClick={() => homeTarget && selectFolder(homeTarget.path)}
              >
                <IconHome size={18} />
              </button>
            )}
            <h1 className="bnt-title" title={showPath ? pathTitle : undefined}>
              {showPath ? (
                breadcrumbs.length ? breadcrumbs.map((folder, index) => {
                  const label = splitLeadingEmoji(folder.title).label || folder.title
                  const current = index === breadcrumbs.length - 1
                  return (
                    <span
                      key={folder.path}
                      className={`bnt-title-crumb${current ? ' is-current' : ''}`}
                    >
                      {index > 0 && <span className="bnt-title-separator"> / </span>}
                      <button
                        type="button"
                        aria-current={current ? 'page' : undefined}
                        onClick={() => selectFolder(folder.path)}
                      >
                        {label}
                      </button>
                    </span>
                  )
                }) : title
              ) : title}
            </h1>
            <span className="bnt-count">{count}</span>
          </div>
          <span className="bnt-spacer" />
          {/* 搜索范围只在搜索时才有意义，没必要长期占着地方 */}
          {searching && (
            <SlidingGroup
              value={settings.search.scope}
              options={scopeOptions(t)}
              onChange={(scope) =>
                updateSettings((p) => ({ ...p, search: { ...p.search, scope } }))
              }
              className="bnt-scope"
              itemClassName="bnt-scope-item"
              role="radiogroup"
              itemRole="radio"
              ariaLabel={t.content.searchScope}
            />
          )}
          <DisplaySettingsPopover />
        </header>

        <div className="bnt-body">
          <div
            className="bnt-scroll"
            onContextMenu={(e) => {
              if (e.target === e.currentTarget) openMenu(e, currentFolder)
            }}
          >
            {searching ? (
              <Grid items={searchResults} />
            ) : currentFolder ? (
              // 最外层也是一个落点：从子目录区块里拖出来丢在空白处 = 回到当前目录。
              // 面积最大，碰撞检测里优先级自然最低，不会抢走更具体的落点。
              <IntoZone node={currentFolder} className="bnt-drop-root">
                {showingSuperRoot ? (
                  <div className="bnt-folder-children">
                    <Grid items={rootChildren} />
                  </div>
                ) : (
                  <FolderContentsRoot folder={currentFolder} setting={settings.folder} />
                )}
              </IntoZone>
            ) : null}
          </div>

          {empty && (
            <div className="bnt-empty">
              <div className="bnt-empty-mark" />
              <div className="bnt-empty-title">
                {searching ? t.content.emptySearch : t.content.emptyFolder}
              </div>
              <div className="bnt-empty-hint">
                {searching
                  ? t.content.emptySearchHint
                  : t.content.emptyFolderHint}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
