/**
 * 运行环境判定。
 *
 * 这个扩展在两种环境下跑：装进浏览器(有 chrome.* API)，以及 `npm run dev`
 * 的普通网页(没有)。platform 层的每个模块都在这里分叉，上层代码不必关心。
 */
export const isExtension =
  typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.bookmarks

export const hasChromeStorage =
  typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage

/** 本机标识，用来判断「本地文件」类资源是不是这台设备添加的 */
export function getDeviceId(): string {
  const KEY = 'bnt.deviceId'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = Math.random().toString(36).slice(2, 10)
    localStorage.setItem(KEY, id)
  }
  return id
}
