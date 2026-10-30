import { ACCENT_PRESETS } from './settingsSchema'
import { currentArea, onAreaChange } from './area'
import { createStore, useStore } from './store'

/** 色板是独立的可编辑资源，和设置一起遵循同步开关，不改动设置的持久化结构。 */
const KEY = 'accentPalette'
const store = createStore<string[]>([...ACCENT_PRESETS])
let lastWritten = JSON.stringify(store.get())
let unwatch: () => void = () => {}
let mutationQueue: Promise<unknown> = Promise.resolve()

function parsePalette(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.some((color) => typeof color !== 'string' || !/^#[\da-f]{6}$/i.test(color))) {
    return [...ACCENT_PRESETS]
  }
  return [...new Set(raw.map((color: string) => color.toLowerCase()))]
}

function watchRemote(): void {
  unwatch()
  const area = currentArea()
  unwatch = area.subscribe(KEY, () => {
    void area.get(KEY).then((raw) => {
      if (area !== currentArea()) return
      const colors = parsePalette(raw)
      const snapshot = JSON.stringify(colors)
      if (snapshot === lastWritten) return
      lastWritten = snapshot
      store.set(colors)
    }).catch((error: unknown) => console.error('读取主要颜色失败', error))
  })
}

/** 串行写入，快速新增、删除不会互相覆盖；写入失败时恢复原色板。 */
function commit(build: (colors: string[]) => string[]): Promise<string[]> {
  const task = mutationQueue.then(async () => {
    const prev = store.get()
    const next = build(prev)
    if (next === prev) return prev
    const snapshot = lastWritten
    lastWritten = JSON.stringify(next)
    store.set(next)
    try {
      await currentArea().set(KEY, next)
      return next
    } catch (error) {
      lastWritten = snapshot
      store.set(prev)
      throw error
    }
  })
  mutationQueue = task.catch(() => {})
  return task
}

export async function loadAccentPalette(): Promise<void> {
  const colors = parsePalette(await currentArea().get(KEY))
  lastWritten = JSON.stringify(colors)
  store.set(colors)
  watchRemote()
}

export function addAccentColor(color: string): Promise<string[]> {
  const normalized = color.toLowerCase()
  return commit((colors) => {
    if (!/^#[\da-f]{6}$/.test(normalized)) throw new Error('颜色格式无效')
    return colors.includes(normalized) ? colors : [...colors, normalized]
  })
}

export function removeAccentColor(color: string): Promise<string[]> {
  return commit((colors) => colors.filter((value) => value !== color.toLowerCase()))
}

export function resetAccentPalette(): Promise<string[]> {
  return commit(() => [...ACCENT_PRESETS])
}

export async function setSyncEnabledForPalette(): Promise<void> {
  await mutationQueue
  await currentArea().set(KEY, store.get())
}

onAreaChange(watchRemote)

export function useAccentPalette(): string[] {
  return useStore(store)
}
