import { useEffect, useState } from 'react'
import type { BookmarkMeta, BookmarkNode } from '../types'
import { faviconUrl, tintFor } from '../platform/favicon'
import { hexToRgb } from '../utils/color'
import { useLocalImage } from './useLocalImage'

/**
 * 取书签图标的主色，用来给卡片铺一层渐变。
 *
 * 做法是把图标画进一张 16×16 的画布再统计像素：跳过透明和接近黑白的点(它们几乎
 * 不携带色彩信息)，剩下的按饱和度加权平均 —— 直接算平均色的话，一个彩色 logo 配
 * 大片白底会被拉成灰。
 *
 * 取不到图标(浏览器没缓存过这个站点)时回落到首字母色块用的那个颜色，
 * 这样开关打开后每张卡片都有色，不会一半有一半没有。
 */
const cache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

function extract(src: string): Promise<string | null> {
  const hit = cache.get(src)
  if (hit !== undefined) return Promise.resolve(hit)
  const existing = inflight.get(src)
  if (existing) return existing

  const task = new Promise<string | null>((resolve) => {
    const img = new Image()
    // 扩展自己的 _favicon/ 和 data：图都是同源的，不必也不该走 CORS;
    // 只有外链图标才需要请求 CORS 头，拿不到就放弃取色(画布被污染)
    const isSameOrigin = src.startsWith('data:') || src.startsWith(location.origin)
    if (!isSameOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 16
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)

        let r = 0
        let g = 0
        let b = 0
        let weight = 0
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3]
          if (alpha < 128) continue
          const [pr, pg, pb] = [data[i], data[i + 1], data[i + 2]]
          const max = Math.max(pr, pg, pb)
          const min = Math.min(pr, pg, pb)
          const sat = max === 0 ? 0 : (max - min) / max
          // 太暗、太亮、太灰的像素基本是描边和留白，不参与取色
          if (max < 26 || min > 236 || sat < 0.12) continue
          const w = sat * sat
          r += pr * w
          g += pg * w
          b += pb * w
          weight += w
        }
        if (weight === 0) return resolve(null)
        resolve(
          `${Math.round(r / weight)},${Math.round(g / weight)},${Math.round(b / weight)}`,
        )
      } catch {
        // 跨域图片会污染画布，getImageData 直接抛 —— 当作取不到色
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  }).then((value) => {
    cache.set(src, value)
    inflight.delete(src)
    return value
  })

  inflight.set(src, task)
  return task
}

/** 返回 `"r,g,b"`，供 CSS 里 `rgba(var(--bnt-card-tint), .28)` 使用 */
export function useCardTint(
  node: BookmarkNode,
  meta: BookmarkMeta | undefined,
  enabled: boolean,
  /** 不传时沿用字母色块颜色；主题也可以明确提供自己的无图标兜底色。 */
  fallbackTint?: string | null,
): string | null {
  const localId = meta?.icon?.kind === 'local' ? meta.icon.id : undefined
  const localSrc = useLocalImage(enabled && node.url ? localId : undefined)

  const src = !node.url
    ? null
    : meta?.icon?.kind === 'url'
      ? meta.icon.url
      : localId
        ? (localSrc ?? null)
        : faviconUrl(node.url, 32)

  const fallback = node.url
    ? fallbackTint === undefined
      ? hexToRgb(tintFor(node.key || node.title))
      : fallbackTint
    : null
  const [tint, setTint] = useState<string | null>(() => (src ? (cache.get(src) ?? null) : null))

  useEffect(() => {
    if (!enabled || !src) {
      setTint(null)
      return
    }
    let alive = true
    void extract(src).then((value) => {
      if (alive) setTint(value)
    })
    return () => {
      alive = false
    }
  }, [enabled, src])

  if (!enabled || !node.url) return null
  return tint ?? fallback
}
