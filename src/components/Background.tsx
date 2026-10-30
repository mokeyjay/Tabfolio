import { useEffect, useMemo, useRef, useState } from 'react'
import type { BackgroundFit, RuntimeWallpaper, Settings } from '../types'
import { useLocalImage } from '../hooks/useLocalImage'
import { useDirectorySources, useLinkedImage } from '../state/directoryStore'
import {
  nextIndex,
  periodMs,
  readRotation,
  rotationWallpapers,
  writeRotation,
} from '../state/wallpaper'
import { ensureBingWallpaper, useBingWallpaperState } from '../state/bingWallpaper'

/**
 * 决定当前该显示哪张壁纸。
 *
 * 启动时该显示哪一张已经由 `resolveActiveWallpaper`(在 boot 里)算好并写进进度了，
 * 这里只负责页面开着期间的后续切换 —— 挂载时不再推进一次，否则会一次跳两张。
 * 间隔设为 0 时整个计时器不启用：那一档只在开新标签页时换。
 */
function useRotatingWallpaper(settings: Settings): RuntimeWallpaper | undefined {
  const bing = useBingWallpaperState()
  // 本地目录手动刷新后需要重新计算候选项；索引本身不放进可同步设置。
  const directoryState = useDirectorySources()
  const bg = settings.background

  const list = useMemo(
    () => rotationWallpapers(settings),
    [settings, directoryState.sources],
  )
  const [index, setIndex] = useState(() => readRotation().index)

  useEffect(() => {
    if (bg.rotate === 'off' || list.length < 2) return
    const period = periodMs(settings)
    // 间隔 0 的含义是「每次打开新标签页换一张」，页面开着期间不再自己走
    if (period <= 0) return

    let timer: ReturnType<typeof setTimeout>
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        const current = readRotation().index
        const next = nextIndex(current, list.length, bg.rotate === 'random')
        writeRotation({ index: next, since: Date.now() })
        setIndex(next)
        schedule(period)
      }, delay)
    }
    // 补上本轮剩余的时间，之后按固定周期走
    schedule(Math.max(0, period - (Date.now() - readRotation().since)))
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bg.rotate, bg.intervalMinutes, list.length])

  useEffect(() => {
    if (bg.bingEnabled) void ensureBingWallpaper()
  }, [bg.bingEnabled])

  // Bing 开关可以从其他设备同步过来，但权限不能。尚未授权或首次加载失败时，
  // 暂时沿用用户原来的壁纸，授权成功后再淡入 Bing 图片。
  if (bg.bingEnabled && bing.wallpaper) return bing.wallpaper
  if (!list.length) return undefined
  return list[index % list.length]
}

/** 填充方式 -> background-size / repeat */
export function fitStyle(fit: BackgroundFit): {
  backgroundSize: string
  backgroundRepeat: string
} {
  switch (fit) {
    case 'contain':
      return { backgroundSize: 'contain', backgroundRepeat: 'no-repeat' }
    case 'stretch':
      return { backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' }
    case 'tile':
      return { backgroundSize: 'auto', backgroundRepeat: 'repeat' }
    default:
      return { backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }
  }
}

export function Background({ settings }: { settings: Settings }) {
  const bg = settings.background
  const wall = useRotatingWallpaper(settings)
  const localSrc = useLocalImage(wall?.kind === 'local' ? wall.id : undefined)
  const linkedSrc = useLinkedImage(wall?.kind === 'linked' ? wall : undefined)

  // 首屏不能淡入 —— 图已经预读好了，再从透明淡进来本身就是一次闪。
  // 只有轮换换图时才走淡入。
  const firstWallId = useRef<string | undefined>(wall?.id)
  const isFirstPaint = firstWallId.current === wall?.id

  const src =
    wall?.kind === 'url' || wall?.kind === 'bing'
      ? wall.url
      : wall?.kind === 'local'
        ? (localSrc ?? null)
        : wall?.kind === 'linked'
          ? (linkedSrc ?? null)
          : null
  // 渐变类壁纸本身就铺满，填充方式只对图片有意义
  const isGradient = wall?.kind === 'preset'
  const fit = fitStyle(bg.fit)

  return (
    <div className="bnt-bg">
      <div
        // 换图时重挂一层，让新图淡入而不是硬切
        key={wall?.id ?? 'none'}
        className={`bnt-bg-layer${isFirstPaint ? '' : ' is-swapping'}`}
        style={{
          backgroundImage: isGradient ? wall.css : src ? `url("${src}")` : undefined,
          backgroundPosition: 'center',
          ...(isGradient ? { backgroundSize: 'cover', backgroundRepeat: 'no-repeat' } : fit),
          filter: bg.blur ? `blur(${bg.blur}px)` : undefined,
        }}
      />
      {bg.dim > 0 && <div className="bnt-bg-dim" style={{ opacity: bg.dim / 100 }} />}
    </div>
  )
}
