import { useCallback, useMemo } from 'react'
import type { BookmarkNode } from '../types'
import { useApp } from '../app/AppContext'
import { collectBookmarks } from '../platform/bookmarks'
import { updateSettings } from '../state/settingsStore'
import { useResizable } from '../hooks/useResizable'
import { SIDEBAR_MAX, SIDEBAR_MIN } from '../state/settingsSchema'
import { BookmarkIcon } from './BookmarkIcon'
import { IconChevronRight } from './icons'
import { useMessages, type Messages } from '../i18n'

function relativeTime(ts: number, t: Messages): string {
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return t.right.justNow
  if (min < 60) return t.right.minutesAgo(min)
  const hour = Math.round(min / 60)
  if (hour < 24) return t.right.hoursAgo(hour)
  const day = Math.round(hour / 24)
  if (day === 1) return t.right.yesterday
  if (day < 30) return t.right.daysAgo(day)
  const month = Math.round(day / 30)
  if (month < 12) return t.right.monthsAgo(month)
  return t.right.yearsAgo(Math.round(month / 12))
}

function Section({
  title,
  items,
  empty,
}: {
  title: string
  items: { node: BookmarkNode; meta: string }[]
  empty: string
}) {
  const { open, meta, openMenu } = useApp()
  const t = useMessages()
  return (
    <section className="bnt-right-section">
      <div className="bnt-right-title">{title}</div>
      {items.length === 0 && <div className="bnt-right-empty">{empty}</div>}
      {items.map(({ node, meta: label }) => (
        <button
          type="button"
          key={node.id}
          className="bnt-right-item"
          title={`${node.title}\n${node.url}`}
          onClick={(e) => open(node, e.metaKey || e.ctrlKey)}
          onContextMenu={(e) => openMenu(e, node)}
        >
          <BookmarkIcon node={node} meta={meta[node.key]} size={22} />
          <span className="bnt-right-name">{node.title || t.common.untitled}</span>
          <span className="bnt-right-meta">{label}</span>
        </button>
      ))}
    </section>
  )
}

export function RightPanel() {
  const { root, stats, settings } = useApp()
  const t = useMessages()

  const commitWidth = useCallback((rightWidth: number) => {
    updateSettings((p) => ({ ...p, sidebar: { ...p.sidebar, rightWidth } }))
  }, [])
  // 把手在左边缘，所以往左拖是变宽
  const resize = useResizable({
    value: settings.sidebar.rightWidth,
    min: SIDEBAR_MIN,
    max: SIDEBAR_MAX,
    onCommit: commitWidth,
    invert: true,
  })

  const all = useMemo(() => collectBookmarks(root), [root])

  const recent = useMemo(
    () =>
      [...all]
        .sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0))
        .slice(0, 8)
        .map((node) => ({
          node,
          meta: node.dateAdded ? relativeTime(node.dateAdded, t) : '',
        })),
    [all, t],
  )

  const frequent = useMemo(
    () =>
      all
        .map((node) => ({ node, stat: stats[node.key] }))
        .filter((x) => x.stat?.count)
        .sort((a, b) => b.stat!.count - a.stat!.count)
        .slice(0, 8)
        .map(({ node, stat }) => ({ node, meta: t.right.visits(stat!.count) })),
    [all, stats, t],
  )

  /*
   * 收起时不卸载，而是用负 margin 把自己推出视口 —— 这样展开/收起都有滑动动画。
   * 负值要把 .bnt-app 的 gap 也算进去，否则收起后右边会多留一条 14px 的空隙。
   */
  const collapsed = !settings.sidebar.rightOpen
  return (
    <aside
      className={`bnt-panel bnt-right${resize.dragging ? ' is-resizing' : ''}${
        collapsed ? ' is-collapsed' : ''
      }`}
      aria-hidden={collapsed}
      style={{
        width: resize.width,
        marginRight: collapsed ? -(resize.width + 14) : 0,
      }}
    >
      <div
        className="bnt-resizer bnt-resizer-left"
        role="separator"
        aria-label={t.right.resize}
        aria-orientation="vertical"
        onPointerDown={resize.onPointerDown}
        onDoubleClick={() => commitWidth(282)}
        title={t.sidebar.resizeHint}
      />
      <div className="bnt-right-head">{t.right.head}</div>
      <div className="bnt-right-body">
        <Section
          title={t.right.mostVisited}
          items={frequent}
          empty={t.right.mostVisitedEmpty}
        />
        <Section title={t.right.recentlyAdded} items={recent} empty={t.right.recentlyAddedEmpty} />
      </div>
      <div className="bnt-right-foot">
        <span className="bnt-spacer" />
        <button
          type="button"
          className="bnt-iconbtn"
          title={t.right.collapse}
          aria-label={t.right.collapse}
          onClick={() =>
            updateSettings((p) => ({ ...p, sidebar: { ...p.sidebar, rightOpen: false } }))
          }
        >
          <IconChevronRight size={15} />
        </button>
      </div>
    </aside>
  )
}
