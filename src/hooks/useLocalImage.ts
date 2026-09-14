import { useEffect, useState } from 'react'
import { getImage } from '../platform/blobs'

/**
 * 读取存在 storage.local 里的图片。
 * 结果按 id 缓存 —— 同一张背景图在设置面板和页面背景上会被要好几次。
 */
const cache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

export function loadLocalImage(id: string): Promise<string | null> {
  if (cache.has(id)) return Promise.resolve(cache.get(id) ?? null)
  const existing = inflight.get(id)
  if (existing) return existing
  const task = getImage(id)
    .then((rec) => {
      const value = rec?.dataUrl ?? null
      cache.set(id, value)
      inflight.delete(id)
      return value
    })
    .catch((error: unknown) => {
      console.error('读取本地图片失败', error)
      cache.set(id, null)
      inflight.delete(id)
      return null
    })
  inflight.set(id, task)
  return task
}

export function invalidateLocalImage(id: string): void {
  cache.delete(id)
  inflight.delete(id)
}

/** undefined = 还在读；null = 本机没有这张图 */
export function useLocalImage(id: string | undefined): string | null | undefined {
  const [src, setSrc] = useState<string | null | undefined>(() =>
    id ? cache.get(id) : null,
  )
  useEffect(() => {
    if (!id) {
      setSrc(null)
      return
    }
    if (cache.has(id)) {
      setSrc(cache.get(id) ?? null)
      return
    }
    let alive = true
    setSrc(undefined)
    void loadLocalImage(id).then((value) => {
      if (alive) setSrc(value)
    })
    return () => {
      alive = false
    }
  }, [id])
  return src
}
