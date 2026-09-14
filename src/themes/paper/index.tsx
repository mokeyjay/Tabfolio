import type { ThemeDefinition, ThemeOptionValue } from '../types'
import { PaperLayout } from './PaperLayout'
import './paper.css'

/** 一档纸色：纸底(整页)、纸面(托内容的那张纸)、墨色(RGB 三元组) */
type Tone = { ground: string; sheet: string; ink: string }

/**
 * 颜色的自变量只有这三个 —— 其余所有颜色(文字、描边、卡片、分隔线)都是
 * 「墨色 × 透明度」压在纸上。深色方案里墨色本身是浅的，同一份 alpha 公式
 * 直接就变成浅色描边，所以两套方案共用一份推导，只换这三个值。
 *
 * 明暗方案是 CSS 的事(prefers-color-scheme / data-scheme),JS 这边不知道当前是哪档，
 * 于是两组一起发出去，由 paper.css 选一组接上。
 */
const TONES: Record<string, { light: Tone; dark: Tone }> = {
  warm: {
    light: { ground: '#f2efe7', sheet: '#fffdf8', ink: '44, 39, 30' },
    dark: { ground: '#17150f', sheet: '#221f18', ink: '246, 241, 230' },
  },
  plain: {
    light: { ground: '#f4f4f2', sheet: '#ffffff', ink: '26, 26, 28' },
    dark: { ground: '#131315', sheet: '#1d1d20', ink: '242, 242, 245' },
  },
  cool: {
    light: { ground: '#ecf0f4', sheet: '#ffffff', ink: '22, 29, 38' },
    dark: { ground: '#10131a', sheet: '#1a1e26', ink: '234, 239, 247' },
  },
}

export const paperTheme: ThemeDefinition = {
  id: 'paper',
  name: (t) => t.theme.paperName,
  description: (t) => t.theme.paperDescription,
  /*
   * 纸不透光，所以这里没有模糊度和透明度可调；圆角和阴影又是全局设置 ——
   * 剩下归主题自己管的就只有「什么色的纸」和「盖住壁纸几分」。
   * 「纸面浓度」是唯一和壁纸有关的一档：调低就让壁纸从纸底透上来。
   */
  options: [
    {
      key: 'tone',
      label: (t) => t.theme.paperTone,
      type: 'select',
      default: 'warm',
      choices: [
        { value: 'warm', label: (t) => t.theme.paperToneWarm },
        { value: 'plain', label: (t) => t.theme.paperTonePlain },
        { value: 'cool', label: (t) => t.theme.paperToneCool },
      ],
    },
    {
      key: 'wash',
      label: (t) => t.theme.paperWash,
      type: 'range',
      default: 100,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    },
  ],
  /*
   * 纸的尺度更松：圆角更大、阴影压到四成(纸不该浮起来)、卡片也更宽更高。
   * 另外两项是这套主题的重点 —— 卡片染色让白纸上有一层淡淡的图标色，
   * 目录展开 + 面包屑则把「一张纸装完一个目录」这件事说清楚。
   */
  recommends: {
    radius: 18,
    shadow: 45,
    // 一整页都是灰白，主色是唯一的一块饱和色，取一支清透的绿
    accent: '#12b886',
    layout: { cardWidth: 268, cardHeight: 68, maxContentWidth: 1180, contentTopPercent: 0 },
    display: { showDomain: true, showFolderPath: true, tintCards: true, tintStrength: 16 },
    folder: { mode: 'expanded', expandAll: false, rows: 2, child: null },
  },
  vars(options: Record<string, ThemeOptionValue>) {
    const tone = TONES[String(options.tone)] ?? TONES.warm
    const number = (value: unknown, fallback: number) => Number(value ?? fallback)
    const ratio = (value: unknown, fallback: number) =>
      String(Math.min(1, Math.max(0, number(value, fallback) / 100)))

    return {
      '--bnt-paper-ground-l': tone.light.ground,
      '--bnt-paper-sheet-l': tone.light.sheet,
      '--bnt-paper-ink-l': tone.light.ink,
      '--bnt-paper-ground-d': tone.dark.ground,
      '--bnt-paper-sheet-d': tone.dark.sheet,
      '--bnt-paper-ink-d': tone.dark.ink,
      '--bnt-paper-wash': ratio(options.wash, 100),
    }
  },
  Layout: PaperLayout,
}
