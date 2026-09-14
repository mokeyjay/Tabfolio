/**
 * 归一化 URL，作为书签自有数据(备注/标签/自定义图标/置顶)的跨设备稳定主键。
 *
 * 为什么不用书签 id:chrome.bookmarks 的 id 是每台设备本地生成的，同一个书签
 * 在两台电脑上 id 不同。用 id 做 key 存进 storage.sync，跨设备一定错位。
 */
export function normalizeUrl(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    const protocol = u.protocol.toLowerCase()
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    const defaultPort =
      (protocol === 'http:' && u.port === '80') || (protocol === 'https:' && u.port === '443')
    const port = defaultPort ? '' : u.port
    const path = u.pathname.replace(/\/+$/, '')
    return `${protocol}//${host}${port ? ':' + port : ''}${path}${u.search}${u.hash}`
  } catch {
    return s
  }
}

/** 卡片副标题上显示的域名 */
export function displayDomain(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, '')
  } catch {
    return raw
  }
}

/** 用户在地址栏里习惯少打 scheme，保存时补上 */
export function ensureScheme(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s
  return `https://${s}`
}

export function isValidUrl(raw: string): boolean {
  try {
    new URL(ensureScheme(raw))
    return true
  } catch {
    return false
  }
}
