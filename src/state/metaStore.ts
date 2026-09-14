import type { BookmarkMeta } from '../types'
import { createStore, useStore } from './store'
import { currentArea, onAreaChange } from './area'

/**
 * 书签附加数据(自定义图标、置顶)。
 *
 * chrome.bookmarks 的 BookmarkTreeNode 只有 id/parentId/index/title/url/dateAdded,
 * 没有任何可写的自定义字段，所以这些只能扩展自己存。key 用归一化 URL(目录用路径),
 * 因为书签 id 是每台设备本地生成的，跨设备对不上。
 */
export type MetaMap = Record<string, BookmarkMeta>

const store = createStore<MetaMap>({})
let lastWritten = '{}'
let unwatch: () => void = () => {}
let mutationQueue: Promise<void> = Promise.resolve()

/** Meta 修改串行落盘；失败时回滚内存，调用方可以给用户明确反馈。 */
function commit(build: (prev: MetaMap) => MetaMap): Promise<void> {
  const task = mutationQueue.then(async () => {
    const prev = store.get()
    const next = build(prev)
    if (next === prev) return
    const previousSnapshot = JSON.stringify(prev)
    lastWritten = JSON.stringify(next)
    store.set(next)
    try {
      await currentArea().set('meta', next)
    } catch (error) {
      lastWritten = previousSnapshot
      store.set(prev)
      throw error
    }
  })
  mutationQueue = task.catch(() => {})
  return task
}

function watchRemote() {
  unwatch()
  const area = currentArea()
  unwatch = area.subscribe('meta', () => {
    void area.get<MetaMap>('meta').then((value) => {
      const raw = value ?? {}
      const snapshot = JSON.stringify(raw)
      if (snapshot === lastWritten) return
      lastWritten = snapshot
      store.set(raw)
    }).catch((error: unknown) => {
      console.error('读取同步书签附加数据失败', error)
    })
  })
}

export async function loadMeta(): Promise<void> {
  const raw = (await currentArea().get<MetaMap>('meta')) ?? {}
  lastWritten = JSON.stringify(raw)
  store.set(raw)
  watchRemote()
}

/** 空对象不落盘，避免 meta 里堆一堆 `{}` 白占 sync 配额 */
function isEmpty(meta: BookmarkMeta): boolean {
  return !meta.icon
}

export function updateMeta(key: string, patch: Partial<BookmarkMeta>): Promise<void> {
  if (!key) return Promise.resolve()
  return commit((prev) => {
    const merged: BookmarkMeta = { ...prev[key], ...patch }
    const next = { ...prev }
    if (isEmpty(merged)) delete next[key]
    else next[key] = merged
    return next
  })
}

/** 批量删除并返回被删记录，资源层可据此清理本地图片。 */
export async function removeMetaKeys(keys: Iterable<string>): Promise<BookmarkMeta[]> {
  const unique = new Set(keys)
  const removed: BookmarkMeta[] = []
  await commit((prev) => {
    const next = { ...prev }
    for (const key of unique) {
      if (!prev[key]) continue
      removed.push(prev[key])
      delete next[key]
    }
    return removed.length ? next : prev
  })
  return removed
}

/** 根据同一台设备上的书签 id，让附加数据跟随本次改名或移动。 */
export function remapMetaKeys(mappings: Iterable<readonly [string, string]>): Promise<void> {
  const pairs = [...mappings].filter(([from, to]) => from && to && from !== to)
  if (!pairs.length) return Promise.resolve()
  return commit((prev) => {
    const moved = pairs.flatMap(([from, to]) => prev[from] ? [[from, to, prev[from]] as const] : [])
    if (!moved.length) return prev
    const next = { ...prev }
    moved.forEach(([from]) => delete next[from])
    moved.forEach(([, to, meta]) => {
      next[to] = { ...next[to], ...meta }
    })
    return next
  })
}

export async function setSyncEnabledForMeta(): Promise<void> {
  await currentArea().set('meta', store.get())
}

onAreaChange(() => {
  watchRemote()
})

export function useMeta(): MetaMap {
  return useStore(store)
}

export function getMeta(): MetaMap {
  return store.get()
}
