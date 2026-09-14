import type { BingWallpaper } from '../types'
import { isExtension } from '../platform/env'
import { localArea } from '../platform/storage'
import { createStore, useStore } from './store'

const BING_ORIGIN = 'https://www.bing.com'
const BING_PERMISSION = 'https://www.bing.com/'
const CACHE_KEY = 'bingWallpaper'
const CACHE_MAX_AGE = 6 * 60 * 60 * 1000

interface BingCache {
  wallpaper: BingWallpaper
  market: string
  fetchedAt: number
}

export interface BingWallpaperState {
  ready: boolean
  loading: boolean
  permission: 'checking' | 'granted' | 'missing'
  wallpaper: BingWallpaper | null
  fetchedAt: number | null
  error: string | null
}

const store = createStore<BingWallpaperState>({
  ready: false,
  loading: false,
  permission: 'checking',
  wallpaper: null,
  fetchedAt: null,
  error: null,
})

let cacheLoaded = false
let cache: BingCache | null = null
let refreshing: Promise<BingWallpaper | null> | null = null

function market(): string {
  const languages = typeof navigator === 'undefined'
    ? []
    : navigator.languages ?? [navigator.language]
  return languages.some((tag) => tag?.toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en-US'
}

function parseCache(raw: unknown): BingCache | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<BingCache>
  const wall = value.wallpaper as Partial<BingWallpaper> | undefined
  if (
    !wall ||
    wall.kind !== 'bing' ||
    typeof wall.id !== 'string' ||
    typeof wall.name !== 'string' ||
    typeof wall.url !== 'string' ||
    typeof wall.date !== 'string' ||
    typeof wall.copyright !== 'string' ||
    typeof wall.copyrightLink !== 'string' ||
    typeof value.market !== 'string' ||
    typeof value.fetchedAt !== 'number'
  ) return null
  try {
    const url = new URL(wall.url)
    const copyrightLink = new URL(wall.copyrightLink)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'www.bing.com' ||
      copyrightLink.protocol !== 'https:' ||
      copyrightLink.hostname !== 'www.bing.com'
    ) return null
  } catch {
    return null
  }
  return value as BingCache
}

async function loadCache(): Promise<void> {
  if (cacheLoaded) return
  cacheLoaded = true
  cache = parseCache(await localArea.get(CACHE_KEY))
  if (!cache) return
  store.set({
    ...store.get(),
    wallpaper: cache.wallpaper,
    fetchedAt: cache.fetchedAt,
  })
}

export async function hasBingPermission(): Promise<boolean> {
  // 开发网页由 Vite 同源代理代发请求，不需要浏览器扩展权限。
  if (!isExtension) return true
  return chrome.permissions.contains({ origins: [BING_PERMISSION] })
}

export async function requestBingPermission(): Promise<boolean> {
  if (!isExtension) {
    store.set({ ...store.get(), permission: 'granted' })
    return true
  }
  const manifest = chrome.runtime.getManifest() as chrome.runtime.Manifest & {
    optional_host_permissions?: string[]
  }
  if (!manifest.optional_host_permissions?.includes(BING_PERMISSION)) {
    throw new BingPermissionManifestError()
  }
  let granted: boolean
  try {
    granted = await chrome.permissions.request({ origins: [BING_PERMISSION] })
  } catch (cause) {
    if (
      cause instanceof Error &&
      cause.message.includes('Only permissions specified in the manifest may be requested')
    ) throw new BingPermissionManifestError()
    throw cause
  }
  store.set({ ...store.get(), permission: granted ? 'granted' : 'missing' })
  return granted
}

export class BingPermissionManifestError extends Error {
  constructor() {
    super('Bing optional host permission is not active')
    this.name = 'BingPermissionManifestError'
  }
}

interface BingApiImage {
  startdate?: unknown
  url?: unknown
  copyright?: unknown
  copyrightlink?: unknown
  title?: unknown
  wp?: unknown
  hsh?: unknown
}

function parseWallpaper(raw: unknown): BingWallpaper {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { images?: unknown }).images)) {
    throw new Error('响应结构不正确')
  }
  const images = (raw as { images: BingApiImage[] }).images
  const image = images.find((item) => item?.wp === true)
  if (
    !image ||
    typeof image.startdate !== 'string' ||
    typeof image.url !== 'string' ||
    typeof image.copyright !== 'string' ||
    typeof image.copyrightlink !== 'string'
  ) {
    throw new Error('最近没有可用作壁纸的图片')
  }

  const url = new URL(image.url, BING_ORIGIN)
  const copyrightLink = new URL(image.copyrightlink, BING_ORIGIN)
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'www.bing.com' ||
    copyrightLink.protocol !== 'https:' ||
    copyrightLink.hostname !== 'www.bing.com'
  ) {
    throw new Error('图片地址来源不受信任')
  }

  const title = typeof image.title === 'string' && image.title.trim()
    ? image.title.trim()
    : image.copyright
  const hash = typeof image.hsh === 'string' ? image.hsh : image.startdate
  return {
    id: `bing:${image.startdate}:${hash}`,
    name: title,
    kind: 'bing',
    url: url.toString(),
    date: image.startdate,
    copyright: image.copyright,
    copyrightLink: copyrightLink.toString(),
  }
}

function apiUrl(currentMarket: string): string {
  const query = new URLSearchParams({
    format: 'js',
    idx: '0',
    n: '8',
    mkt: currentMarket,
  })
  return isExtension
    ? `${BING_ORIGIN}/HPImageArchive.aspx?${query}`
    : `/__bnt-bing-wallpaper?${query}`
}

async function fetchWallpaper(currentMarket: string): Promise<BingWallpaper> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(apiUrl(currentMarket), {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-cache',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return parseWallpaper(await response.json())
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 从本机缓存恢复 Bing 壁纸，并在已授权且缓存过期时更新。
 *
 * 开关可能从另一台设备同步过来，但站点权限不会同步。因此这里只检查权限，
 * 绝不在启动阶段主动弹授权框。
 */
export async function ensureBingWallpaper(force = false): Promise<BingWallpaper | null> {
  try {
    await loadCache()
  } catch (cause) {
    cacheLoaded = true
    const message = cause instanceof Error ? cause.message : String(cause)
    store.set({ ...store.get(), ready: true, error: message })
  }
  if (refreshing) return refreshing

  refreshing = (async () => {
    try {
      const granted = await hasBingPermission()
      const currentMarket = market()
      const fresh = !!cache &&
        cache.market === currentMarket &&
        Date.now() - cache.fetchedAt < CACHE_MAX_AGE

      store.set({
        ...store.get(),
        ready: true,
        permission: granted ? 'granted' : 'missing',
        loading: granted && (force || !fresh),
        error: null,
      })
      if (!granted || (!force && fresh)) return store.get().wallpaper

      const wallpaper = await fetchWallpaper(currentMarket)
      cache = { wallpaper, market: currentMarket, fetchedAt: Date.now() }
      store.set({
        ready: true,
        loading: false,
        permission: 'granted',
        wallpaper,
        fetchedAt: cache.fetchedAt,
        error: null,
      })
      await localArea.set(CACHE_KEY, cache).catch((cause: unknown) => {
        console.error('缓存 Bing 壁纸信息失败', cause)
      })
      return wallpaper
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      store.set({ ...store.get(), ready: true, loading: false, error: message })
      return store.get().wallpaper
    }
  })()

  try {
    return await refreshing
  } finally {
    refreshing = null
  }
}

export function getBingWallpaperState(): BingWallpaperState {
  return store.get()
}

export function useBingWallpaperState(): BingWallpaperState {
  return useStore(store)
}
