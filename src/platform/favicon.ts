import { isExtension } from './env'

/**
 * 网站图标。
 *
 * MV3 里 `chrome://favicon` 已经废弃，取而代之的是扩展自己的 `_favicon/` 端点
 * (需要 manifest 里的 "favicon" 权限)。它读的是浏览器本地图标缓存，不发网络请求，
 * 因此没有隐私成本 —— 但也意味着从没访问过的站点取不到图，由调用方回落到字母色块。
 */
export function faviconUrl(pageUrl: string, size = 32): string | null {
  // 开发环境(普通网页)没有这个端点。这里刻意不去借用公共 favicon 服务：
  // 那类服务对未知域名会返回一张几乎空白的默认图而不是 404，反而让色块兜底
  // 永远触发不了 —— 开发时看到的就不是真实效果了，还平白发出网络请求。
  if (!isExtension || !pageUrl) return null
  const url = new URL(chrome.runtime.getURL('/_favicon/'))
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', String(size))
  return url.toString()
}

/** 没有图标时的字母色块 —— 同一站点每次都得到同一个颜色 */
const TINTS = ['#0071e3', '#5856d6', '#34a2a2', '#e08c1f', '#d0455f', '#2f8a4c', '#3f8ae0', '#6b7fd7']

export function tintFor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

export function monogram(title: string): string {
  const t = title.trim()
  if (!t) return '·'
  // 中文取首字，拉丁文取首字母
  return [...t][0].toUpperCase()
}
