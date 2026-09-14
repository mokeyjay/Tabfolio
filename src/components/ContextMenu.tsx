import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import { collectBookmarks } from '../platform/bookmarks'
import { openAll } from '../platform/tabs'
import { updateSettings } from '../state/settingsStore'
import { removeBookmark } from '../state/bookmarksStore'
import { splitLeadingEmoji } from '../utils/emoji'
import { useDismiss } from '../hooks/useDismiss'
import { IconEdit, IconExternal, IconPinOutline, IconTrash, IconUnpin } from './icons'
import { useMessages } from '../i18n'

export function ContextMenu() {
  const { menu, closeMenu, settings, open, setEditNode, askConfirm, showToast } = useApp()
  const t = useMessages()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: menu!.x, y: menu!.y })
  const { closing, dismiss } = useDismiss(closeMenu)

  // 贴着视口边缘弹出时把菜单收回来
  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({
      x: Math.min(menu.x, window.innerWidth - rect.width - 8),
      y: Math.min(menu.y, window.innerHeight - rect.height - 8),
    })
  }, [menu])

  useEffect(() => {
    document.addEventListener('mousedown', dismiss)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [menu, dismiss])

  const node = menu!.node!
  const isFolder = !node.url
  const label = splitLeadingEmoji(node.title).label
  const isPinnedFolder = isFolder && settings.selection.pinnedFolderPath === node.path

  // 动作立刻执行，菜单自己淡出
  const run = (fn: () => void) => () => {
    dismiss()
    fn()
  }

  const openAllIn = () => {
    const urls = collectBookmarks(node)
      .map((b) => b.url!)
      .filter(Boolean)
    if (!urls.length) {
      showToast(t.menu.emptyFolder)
      return
    }

    const threshold = Math.max(0, Math.floor(settings.tabOpening.confirmThreshold))
    if (urls.length <= threshold) {
      openAll(urls)
      return
    }

    askConfirm({
      title: t.menu.openAllTitle,
      message: t.menu.openAllMessage(label, urls.length, threshold),
      confirmLabel: t.menu.openAllConfirm(urls.length),
      danger: true,
      onConfirm: () => openAll(urls),
    })
  }

  return (
    <div
      ref={ref}
      className={`bnt-menu bnt-glass${closing ? ' is-closing' : ''}`}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {!isFolder && (
        <>
          <button type="button" className="bnt-menu-item" onClick={run(() => open(node))}>
            <IconExternal size={16} />
            {t.menu.open}
          </button>
          <button
            type="button"
            className="bnt-menu-item"
            onClick={run(() => open(node, true))}
          >
            <IconExternal size={16} />
            {t.menu.openInNewTab}
            <span className="bnt-menu-shortcut">{t.menu.newTabShortcut}</span>
          </button>
          <div className="bnt-menu-sep" />
        </>
      )}

      {isFolder && (
        <>
          <button type="button" className="bnt-menu-item" onClick={run(openAllIn)}>
            <IconExternal size={16} />
            {t.menu.openAll}
            <span className="bnt-menu-shortcut">{node.count}</span>
          </button>
          <button
            type="button"
            className="bnt-menu-item"
            onClick={run(() =>
              updateSettings((p) => ({
                ...p,
                selection: {
                  ...p.selection,
                  pinnedFolderPath: isPinnedFolder ? null : node.path,
                },
              })),
            )}
          >
            {isPinnedFolder ? <IconUnpin size={16} /> : <IconPinOutline size={16} />}
            {isPinnedFolder ? t.menu.unpin : t.menu.pin}
            <span className="bnt-menu-shortcut">{t.menu.pinHint}</span>
          </button>
          <div className="bnt-menu-sep" />
        </>
      )}

      <button type="button" className="bnt-menu-item" onClick={run(() => setEditNode(node))}>
        <IconEdit size={16} />
        {t.menu.edit}
      </button>
      <div className="bnt-menu-sep" />
      <button
        type="button"
        className="bnt-menu-item is-danger"
        onClick={run(() =>
          askConfirm({
            title: isFolder ? t.menu.deleteFolderTitle : t.menu.deleteBookmarkTitle,
            message: isFolder
              ? t.menu.deleteFolderMessage(label, node.count)
              : t.menu.deleteBookmarkMessage(node.title),
            confirmLabel: t.menu.delete,
            danger: true,
            onConfirm: async () => {
              await removeBookmark(node)
              showToast(t.menu.deleted)
            },
          }),
        )}
      >
        <IconTrash size={16} />
        {t.menu.delete}
      </button>
    </div>
  )
}
