import { isExtension } from './env'

/** 打开书签。新标签页里点书签的默认行为是「在当前标签页打开」。 */
export function openUrl(url: string, opts: { newTab?: boolean; active?: boolean } = {}): void {
  const { newTab = false, active = true } = opts
  if (isExtension) {
    if (newTab) chrome.tabs.create({ url, active })
    else chrome.tabs.update({ url })
    return
  }
  window.open(url, newTab ? '_blank' : '_self')
}

/** 目录右键「全部打开」。二次确认由调用方负责。 */
export function openAll(urls: string[]): void {
  if (!urls.length) return
  if (isExtension) {
    urls.forEach((url, i) => chrome.tabs.create({ url, active: i === 0 }))
    return
  }
  urls.forEach((url) => window.open(url, '_blank'))
}
