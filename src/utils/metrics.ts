import type { CSSProperties } from 'react'
import type { Settings } from '../types'

/**
 * 圆角只有「面板圆角」一个自由变量，控件和卡片都从它推出来 ——
 * 一根滑块就能让整套界面的圆润程度保持同一个调子。
 *
 * 0.68 这个比例是照着原来各处硬写的数值反推的：面板 16px 时控件恰好落在 11px。
 */
export function radiusMetrics(radius: number) {
  const px = (n: number) => `${Math.round(n * 2) / 2}px`
  const ctl = Math.max(0, radius * 0.68)
  return {
    panel: px(Math.max(0, radius)),
    ctl: px(ctl),
    /** 分段控件里的高亮块之类，要比外框再小一圈才同心 */
    inner: px(Math.max(0, ctl - 3)),
    ctlValue: ctl,
  }
}

/**
 * 卡片高度是唯一的自由变量，图标、字号都从它推导 ——
 * 这样用户拖一根滑块就能得到一套比例协调的卡片，而不是十几个互相打架的数值。
 *
 * 只有圆角例外：它以控件圆角为基准，再按卡片高度微调，这样「圆角」那根全局滑块
 * 也能推得动卡片。
 */
export function cardMetrics(height: number, ctlRadius: number) {
  const k = (height - 52) / 56
  const px = (n: number) => `${Math.round(n * 2) / 2}px`
  return {
    cardPad: px(11 + k * 6),
    cardGap: px(11 + k * 4),
    cardRadius: px(ctlRadius * (1 + k * 0.55)),
    iconSize: px(27 + k * 24),
    iconRadius: px(7 + k * 6),
    monoSize: px(13 + k * 8),
    titleSize: px(15 + k * 3.5),
    subSize: px(12.5 + k * 2.5),
  }
}

/** 一行能放几张卡片 —— 「展开」模式按行数截断内容时要用 */
export function columnsFor(containerWidth: number, cardWidth: number, gap = 9): number {
  if (containerWidth <= 0) return 1
  return Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)))
}

export function layoutVars(settings: Settings): CSSProperties {
  const r = radiusMetrics(settings.theme.radius)
  const m = cardMetrics(settings.layout.cardHeight, r.ctlValue)
  const contentTopPercent = Math.max(0, Math.min(100, settings.layout.contentTopPercent))
  return {
    // 圆角和阴影跟主色、明暗一样是全局的：主题只提供自己那套配方，浓淡由这里统一给
    '--bnt-radius-panel': r.panel,
    '--bnt-radius-ctl': r.ctl,
    '--bnt-radius-inner': r.inner,
    '--bnt-shadow-k': String(Math.max(0, settings.theme.shadow) / 100),
    '--bnt-card-w': `${settings.layout.cardWidth}px`,
    '--bnt-card-h': `${settings.layout.cardHeight}px`,
    '--bnt-card-pad': m.cardPad,
    '--bnt-card-gap': m.cardGap,
    '--bnt-card-radius': m.cardRadius,
    '--bnt-icon-size': m.iconSize,
    '--bnt-icon-radius': m.iconRadius,
    '--bnt-mono-size': m.monoSize,
    '--bnt-title-size': m.titleSize,
    '--bnt-sub-size': m.subSize,
    '--bnt-sidebar-w': `${settings.sidebar.width}px`,
    '--bnt-content-top': `${contentTopPercent}vh`,
    '--bnt-max-w': settings.layout.maxContentWidth
      ? `${settings.layout.maxContentWidth}px`
      : 'none',
  } as CSSProperties
}
