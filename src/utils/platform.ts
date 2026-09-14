/**
 * 快捷键提示要跟着系统走：macOS 上是 ⌘K,Windows / Linux 上是 Ctrl+K。
 *
 * `navigator.platform` 已废弃但仍最可靠；新的 userAgentData 只在部分浏览器上有，
 * 两个都查一遍。
 */
export const isMac: boolean = (() => {
  const uaPlatform = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData?.platform
  const value = uaPlatform || navigator.platform || navigator.userAgent
  return /mac|iphone|ipad|ipod/i.test(value)
})()
