import type { Language } from '../types'
import { createStore, useStore } from '../state/store'
import { en, type Messages } from './en'
import { zh } from './zh'

/**
 * 界面语言。
 *
 * 默认跟着浏览器走：认得中文就用中文，其余一律英文 —— 目前只有这两种。
 * 语言存在设置里，所以开着同步的话它也跟着走；但语言的解析结果不进设置，
 * 每台设备按自己的浏览器语言算。
 *
 * 组件用 useMessages() 订阅，切语言时会重渲染；store 那种拿不到 hook 的地方
 * 用 messages() 同步读当前值。
 */

const CATALOG: Record<'en' | 'zh', Messages> = { en, zh }

function detect(): 'en' | 'zh' {
  const list = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]
  return list.some((tag) => tag?.toLowerCase().startsWith('zh')) ? 'zh' : 'en'
}

const store = createStore<{ resolved: 'en' | 'zh' }>({ resolved: detect() })

/** 设置里的偏好 -> 实际用哪套文案 */
export function resolveLanguage(preference: Language): 'en' | 'zh' {
  return preference === 'auto' ? detect() : preference
}

export function setLanguage(preference: Language): void {
  const resolved = resolveLanguage(preference)
  if (resolved !== store.get().resolved) store.set({ resolved })
  if (typeof document === 'undefined') return
  document.documentElement.lang = resolved
  // 标签页标题是这个扩展曝光最多的一处文案，newtab.html 里只能写死一个兜底值，
  // 真正的本地化标题在这里补上 —— 语言一变也要跟着换。
  document.title = CATALOG[resolved].documentTitle
}

export function messages(): Messages {
  return CATALOG[store.get().resolved]
}

export function useMessages(): Messages {
  return CATALOG[useStore(store).resolved]
}

export type { Messages }
