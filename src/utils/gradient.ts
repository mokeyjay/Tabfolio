/**
 * 渐变背景的生成器。
 *
 * 内置的那几张「壁纸」并不是图片，而是一串 CSS 渐变 —— 比如
 *   radial-gradient(120% 100% at 20% 10%, #dfeafc 0%, #c6dbf6 45%, #a9c8ef 100%)
 * 所以它们几乎不占存储、能跨设备同步、还能任意缩放。这里把同一套参数摊开，
 * 用户可以照着造自己的。
 */

export type GradientType = 'radial' | 'linear'

export interface GradientSpec {
  type: GradientType
  /** linear 用的角度，单位度 */
  angle: number
  /** radial 用的圆心位置，单位 % */
  x: number
  y: number
  /** 三个色标，从中心/起点到边缘/终点 */
  colors: [string, string, string]
}

export const DEFAULT_SPEC: GradientSpec = {
  type: 'radial',
  angle: 160,
  x: 20,
  y: 10,
  colors: ['#dfeafc', '#c6dbf6', '#a9c8ef'],
}

export function buildGradient(spec: GradientSpec): string {
  const [a, b, c] = spec.colors
  if (spec.type === 'linear') {
    return `linear-gradient(${spec.angle}deg,${a} 0%,${b} 50%,${c} 100%)`
  }
  return `radial-gradient(120% 100% at ${spec.x}% ${spec.y}%,${a} 0%,${b} 45%,${c} 100%)`
}

/* ---------- 随机配色 ---------- */

function hsl(h: number, s: number, l: number): string {
  // 转成 hex，便于直接喂给 <input type="color">
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * 随机生成一组和谐的配色：同一个色相附近取三档，亮度递减。
 * 完全随机三个颜色多半很难看，限制在邻近色相里才像「设计过」。
 */
export function randomSpec(): GradientSpec {
  const hue = Math.floor(Math.random() * 360)
  const spread = 18 + Math.random() * 34
  const sat = 34 + Math.random() * 32
  const light = 88 - Math.random() * 8
  return {
    type: Math.random() < 0.7 ? 'radial' : 'linear',
    angle: Math.floor(Math.random() * 360),
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
    colors: [
      hsl(hue, sat, light),
      hsl(hue + spread, sat + 6, light - 12),
      hsl(hue + spread * 2, sat + 10, light - 24),
    ],
  }
}
