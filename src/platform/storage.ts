import { hasChromeStorage } from './env'

/**
 * 存储层。
 *
 * chrome.storage.sync 有两道硬限制：单项 8192 字节、总量 102400 字节，
 * 且计量的是「key 长度 + 值的 JSON 串的 UTF-8 字节数」。自定义 CSS、在线壁纸
 * 列表和大量自定义图标地址都可能让单项超限，所以 sync 走分片存储：
 *   `key`                  -> { __chunks: n, __snapshot: id }
 *   `key/<snapshot>/0..n`  -> 字符串分片
 * 分片按 UTF-8 字节切，并且保证不切开代理对(否则会写进非法字符串)。
 */

const PER_ITEM_LIMIT = 8192
/** 给 key、JSON 引号和转义留出余量 */
const CHUNK_BYTES = 5800

const encoder = new TextEncoder()

function byteLen(s: string): number {
  return encoder.encode(s).length
}

/** 按 UTF-8 字节上限切分字符串，不切开代理对 */
export function chunkString(input: string, maxBytes: number): string[] {
  const out: string[] = []
  let start = 0
  while (start < input.length) {
    // 先按最乐观的字符数估一刀，再逐步收缩到字节数达标
    let end = Math.min(input.length, start + maxBytes)
    while (byteLen(input.slice(start, end)) > maxBytes) {
      // 每个字符最多 4 字节，按比例收缩比逐字符退快得多
      const over = byteLen(input.slice(start, end)) - maxBytes
      end -= Math.max(1, Math.ceil(over / 4))
    }
    // 不能停在代理对中间
    if (end < input.length && end > start) {
      const code = input.charCodeAt(end - 1)
      if (code >= 0xd800 && code <= 0xdbff) end -= 1
    }
    if (end <= start) end = start + 1 // 兜底，避免死循环
    out.push(input.slice(start, end))
    start = end
  }
  return out.length ? out : ['']
}

export interface Area {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
  /** 返回取消订阅函数 */
  subscribe(key: string, cb: () => void): () => void
}

interface ChunkHeader {
  __chunks: number
  __snapshot: string
}

function isChunkHeader(v: unknown): v is ChunkHeader {
  return !!v &&
    typeof v === 'object' &&
    typeof (v as ChunkHeader).__chunks === 'number' &&
    typeof (v as ChunkHeader).__snapshot === 'string'
}

class ChromeArea implements Area {
  constructor(
    private area: chrome.storage.StorageArea,
    private chunked: boolean,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    const head = (await this.area.get(key))[key]
    if (head === undefined) return undefined
    if (!isChunkHeader(head)) return head as T
    if (!Number.isInteger(head.__chunks) || head.__chunks < 1 || head.__chunks > 1000) {
      return undefined
    }
    const keys = Array.from(
      { length: head.__chunks },
      (_, i) => `${key}/${head.__snapshot}/${i}`,
    )
    const parts = await this.area.get(keys)
    let json = ''
    for (const k of keys) {
      const part = parts[k]
      if (typeof part !== 'string') return undefined // 分片缺失，当作没有数据
      json += part
    }
    try {
      return JSON.parse(json) as T
    } catch {
      return undefined
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    const json = JSON.stringify(value)
    const needsChunking = this.chunked && byteLen(json) + key.length + 16 > PER_ITEM_LIMIT
    const prev = (await this.area.get(key))[key]
    const oldKeys = isChunkHeader(prev)
      ? Array.from(
          { length: prev.__chunks },
          (_, i) => `${key}/${prev.__snapshot}/${i}`,
        )
      : []

    // 先完整写入新值，再清理旧分片。即使写入因配额或限流失败，上一份快照仍可读取。
    if (!needsChunking) {
      await this.area.set({ [key]: value })
      if (oldKeys.length) await this.area.remove(oldKeys)
      return
    }
    const parts = chunkString(json, CHUNK_BYTES)
    const snapshot = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const payload: Record<string, unknown> = {
      [key]: { __chunks: parts.length, __snapshot: snapshot },
    }
    parts.forEach((p, i) => {
      payload[`${key}/${snapshot}/${i}`] = p
    })
    await this.area.set(payload)
    if (oldKeys.length) await this.area.remove(oldKeys)
  }

  async remove(key: string): Promise<void> {
    const prev = (await this.area.get(key))[key]
    const keys = [key]
    if (isChunkHeader(prev)) {
      for (let i = 0; i < prev.__chunks; i++) {
        keys.push(`${key}/${prev.__snapshot}/${i}`)
      }
    }
    await this.area.remove(keys)
  }

  subscribe(key: string, cb: () => void): () => void {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      // 分片写入会连带触发 `key/0` 之类的变更，统一归到主 key
      if (Object.keys(changes).some((k) => k === key || k.startsWith(`${key}/`))) cb()
    }
    this.area.onChanged.addListener(handler)
    return () => this.area.onChanged.removeListener(handler)
  }
}

/** 开发环境(`npm run dev`)用 localStorage 顶替，不带配额模拟 */
class WebArea implements Area {
  private listeners = new Map<string, Set<() => void>>()
  constructor(private prefix: string) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = localStorage.getItem(this.prefix + key)
    if (raw == null) return undefined
    try {
      return JSON.parse(raw) as T
    } catch {
      return undefined
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    localStorage.setItem(this.prefix + key, JSON.stringify(value))
    this.listeners.get(key)?.forEach((cb) => cb())
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key)
    this.listeners.get(key)?.forEach((cb) => cb())
  }

  subscribe(key: string, cb: () => void): () => void {
    const set = this.listeners.get(key) ?? new Set()
    set.add(cb)
    this.listeners.set(key, set)
    return () => set.delete(cb)
  }
}

export const syncArea: Area = hasChromeStorage
  ? new ChromeArea(chrome.storage.sync, true)
  : new WebArea('bnt.sync.')

export const localArea: Area = hasChromeStorage
  ? new ChromeArea(chrome.storage.local, false)
  : new WebArea('bnt.local.')

/** 读取 sync 已用配额，设置面板里给用户一个直观提示 */
export async function getSyncUsage(): Promise<{ used: number; total: number } | null> {
  if (!hasChromeStorage || !chrome.storage.sync.getBytesInUse) return null
  const used = await chrome.storage.sync.getBytesInUse(null)
  return { used, total: chrome.storage.sync.QUOTA_BYTES ?? 102400 }
}
