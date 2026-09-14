import { useEffect, useState } from 'react'
import type { BookmarkMeta, BookmarkNode } from '../types'
import { faviconUrl, monogram, tintFor } from '../platform/favicon'
import { useLocalImage } from '../hooks/useLocalImage'
import { splitLeadingEmoji } from '../utils/emoji'
import { IconFolder, IconFolderOpen } from './icons'

/**
 * 图标优先级：
 *   目录 —— 名字开头的 emoji > 目录图标
 *   书签 —— 自定义图标 > 浏览器缓存的站点图标 > 首字母色块
 *
 * 站点图标取不到是常态(从没访问过的站点浏览器就没有缓存)，所以色块不是兜底而是
 * 一等公民 —— 它保证任何一屏书签看上去都是完整的。
 *
 * 目录图标不带底色块：emoji 本身就有颜色和形状，再套一层底反而挤得放不下。
 */
export function BookmarkIcon({
  node,
  meta,
  size,
  folderOpen = false,
}: {
  node: BookmarkNode
  meta?: BookmarkMeta
  size?: number
  /** 仅用于没有自定义图标和 Emoji 的目录。 */
  folderOpen?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const localId = meta?.icon?.kind === 'local' ? meta.icon.id : undefined
  const localSrc = useLocalImage(localId)
  const custom =
    meta?.icon?.kind === 'url' ? meta.icon.url : localId ? (localSrc ?? undefined) : undefined
  const candidate = custom ?? (node.url ? (faviconUrl(node.url, 64) ?? undefined) : undefined)

  useEffect(() => {
    setBroken(false)
  }, [candidate])

  const folderEmoji = !node.url ? splitLeadingEmoji(node.title).emoji : null

  // 显式给了尺寸时，字号也得跟着算 —— CSS 里的字号是按卡片图标的变量推的，
  // 直接套到 20px 的树形图标上会溢出。
  const style = size
    ? {
        width: size,
        height: size,
        fontSize: Math.round(size * (folderEmoji ? 1.05 : 0.86)),
      }
    : undefined

  if (candidate && !broken) {
    return (
      <span className="bnt-icon is-image" style={style}>
        <img src={candidate} alt="" loading="lazy" onError={() => setBroken(true)} />
      </span>
    )
  }

  if (!node.url) {
    return (
      <span
        className={`bnt-icon is-folder${folderEmoji ? ' is-emoji' : ''}`}
        style={style}
        aria-hidden
      >
        {folderEmoji ?? (folderOpen ? <IconFolderOpen size="100%" /> : <IconFolder size="100%" />)}
      </span>
    )
  }

  return (
    <span
      className="bnt-icon is-mono"
      style={{
        ...style,
        // 字母块的字号比 emoji 小一档，不然一个汉字会顶满整块
        fontSize: size ? Math.round(size * 0.46) : undefined,
        background: tintFor(node.key || node.title),
      }}
      aria-hidden
    >
      {monogram(node.title)}
    </span>
  )
}
