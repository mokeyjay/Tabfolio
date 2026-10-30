import type { ThemeDefinition, ThemeOptionValue } from '../types'
import { THEME_BACKGROUNDS } from '../backgrounds'
import { AcrylicLayout } from './AcrylicLayout'
import './acrylic.css'

export const acrylicTheme: ThemeDefinition = {
  id: 'acrylic',
  name: (t) => t.theme.acrylicName,
  description: (t) => t.theme.acrylicDescription,
  /*
   * 默认值照 Fluent 的 Acrylic 配方来：30px 高斯模糊、150% 饱和、2% 噪点，
   * 染色层压到八成 —— 系统那档也是这个路子，底下的颜色透得出来但细节看不清。
   */
  options: [
    {
      key: 'opacity',
      label: (t) => t.theme.acrylicOpacity,
      type: 'range',
      default: 80,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    },
    {
      key: 'blur',
      label: (t) => t.theme.acrylicBlur,
      type: 'range',
      default: 30,
      min: 0,
      max: 120,
      step: 1,
      unit: 'px',
    },
    {
      key: 'saturation',
      label: (t) => t.theme.acrylicSaturation,
      type: 'range',
      default: 150,
      min: 0,
      max: 300,
      step: 5,
      unit: '%',
    },
    {
      key: 'noise',
      label: (t) => t.theme.acrylicNoise,
      type: 'range',
      default: 2,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    },
  ],
  /*
   * Fluent 的尺度比 Apple 紧：面板 12px 圆角(控件正好落在 Win11 的 8px)、
   * 阴影更硬更重一档，卡片也小一号，一屏能多摆几张。
   * 主色取 Win11 那支更深的蓝(系统强调色的默认档)，和 macOS 的蓝拉开一点。
   */
  recommends: {
    background: THEME_BACKGROUNDS.acrylic,
    radius: 12,
    shadow: 130,
    accent: '#0067c0',
    layout: { cardWidth: 240, cardHeight: 60, maxContentWidth: 1320, contentTopPercent: 0 },
    display: { showDomain: true, showFolderPath: false, tintCards: false, tintStrength: 18 },
    folder: { mode: 'hidden', expandAll: false, rows: 2, child: null },
  },
  vars(options: Record<string, ThemeOptionValue>) {
    const number = (value: unknown, fallback: number) => Number(value ?? fallback)
    const opacity = Math.min(1, Math.max(0, number(options.opacity, 80) / 100))

    return {
      '--bnt-acrylic-opacity': String(opacity),
      '--bnt-acrylic-card-opacity': String(Math.min(1, opacity + 0.08)),
      '--bnt-acrylic-block-opacity': String(Math.min(1, opacity + 0.04)),
      '--bnt-acrylic-blur': `${number(options.blur, 30)}px`,
      '--bnt-acrylic-saturation': `${number(options.saturation, 150)}%`,
      '--bnt-acrylic-noise': String(number(options.noise, 2) / 100),
    }
  },
  Layout: AcrylicLayout,
}
