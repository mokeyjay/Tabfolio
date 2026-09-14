import type { VisitStat } from '../types'
import { localArea } from '../platform/storage'
import { createStore, debounce, useStore } from './store'

/**
 * 「最常访问」的数据源：扩展自己统计从本页面打开书签的次数。
 *
 * 没有用 chrome.topSites —— 它返回的是浏览器全局最常访问的站点，很可能根本不在
 * 用户的书签里，和这个扩展「展示书签」的定位对不上。
 *
 * 统计只存 storage.local：写入频繁，不该去挤 sync 那 100KB 的配额，
 * 而且「哪台设备上常用什么」本来就是设备本地的事实。
 */
export type StatsMap = Record<string, VisitStat>

const store = createStore<StatsMap>({})
let mutationQueue: Promise<void> = Promise.resolve()

const persist = debounce((map: StatsMap) => {
  void localArea.set('stats', map).catch((error: unknown) => {
    console.error('保存访问统计失败', error)
  })
}, 800)

function commit(build: (prev: StatsMap) => StatsMap): Promise<void> {
  persist.cancel()
  const task = mutationQueue.then(async () => {
    const prev = store.get()
    const next = build(prev)
    if (next === prev) return
    store.set(next)
    try {
      await localArea.set('stats', next)
    } catch (error) {
      store.set(prev)
      throw error
    }
  })
  mutationQueue = task.catch(() => {})
  return task
}

export async function loadStats(): Promise<void> {
  store.set((await localArea.get<StatsMap>('stats')) ?? {})
}

export function recordVisit(key: string): void {
  if (!key) return
  const prev = store.get()
  const cur = prev[key] ?? { count: 0, last: 0 }
  const next = { ...prev, [key]: { count: cur.count + 1, last: Date.now() } }
  store.set(next)
  persist(next)
}

export async function clearStats(): Promise<void> {
  await commit(() => ({}))
}

export function remapStatsKeys(mappings: Iterable<readonly [string, string]>): Promise<void> {
  const pairs = [...mappings].filter(([from, to]) => from && to && from !== to)
  return commit((prev) => {
    const moved = pairs.flatMap(([from, to]) => prev[from] ? [[from, to, prev[from]] as const] : [])
    if (!moved.length) return prev
    const next = { ...prev }
    moved.forEach(([from]) => delete next[from])
    moved.forEach(([, to, stat]) => {
      const current = next[to]
      next[to] = current
        ? { count: current.count + stat.count, last: Math.max(current.last, stat.last) }
        : stat
    })
    return next
  })
}

export function removeStatsKeys(keys: Iterable<string>): Promise<void> {
  const unique = new Set(keys)
  return commit((prev) => {
    const next = { ...prev }
    let changed = false
    for (const key of unique) {
      if (!(key in next)) continue
      delete next[key]
      changed = true
    }
    return changed ? next : prev
  })
}

export function useStats(): StatsMap {
  return useStore(store)
}
