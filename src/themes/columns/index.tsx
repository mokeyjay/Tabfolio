import type { ThemeDefinition, ThemeOptionValue } from '../types'
import { ColumnsLayout } from './ColumnsLayout'
import './columns.css'

type Tone = { ground: string; sheet: string; ink: string }

const TONES: Record<string, { light: Tone; dark: Tone }> = {
  cool: {
    light: { ground: '#eef1f5', sheet: '251, 252, 253', ink: '24, 30, 38' },
    dark: { ground: '#12151a', sheet: '24, 28, 34', ink: '232, 237, 244' },
  },
  neutral: {
    light: { ground: '#f2f2f0', sheet: '252, 252, 251', ink: '28, 28, 30' },
    dark: { ground: '#141415', sheet: '26, 26, 27', ink: '240, 240, 242' },
  },
  warm: {
    light: { ground: '#f3f0e9', sheet: '253, 251, 247', ink: '42, 37, 30' },
    dark: { ground: '#191713', sheet: '31, 28, 24', ink: '243, 238, 229' },
  },
}

export const columnsTheme: ThemeDefinition = {
  id: 'columns',
  name: (t) => t.theme.columnsName,
  description: (t) => t.theme.columnsDescription,
  options: [
    {
      key: 'tone',
      label: (t) => t.theme.columnsTone,
      type: 'select',
      default: 'cool',
      choices: [
        { value: 'cool', label: (t) => t.theme.columnsToneCool },
        { value: 'neutral', label: (t) => t.theme.columnsToneNeutral },
        { value: 'warm', label: (t) => t.theme.columnsToneWarm },
      ],
    },
    {
      key: 'transparency',
      label: (t) => t.theme.columnsTransparency,
      type: 'range',
      // 12% 透明 = 原设计 88% 不透明，换成直观说法但保持默认视觉。
      default: 12,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    },
  ],
  recommends: {
    radius: 8,
    shadow: 35,
    accent: '#3f5d7d',
    layout: {
      // ThemeRecommendation 的结构要求保留此占位值；能力声明会阻止它出现在清单或被应用。
      cardWidth: 272,
      // 框架滑块从 32 px 起按 4 px 递增，取最接近设计稿 66 px 的有效档位。
      cardHeight: 68,
      maxContentWidth: 0,
      contentTopPercent: 0,
    },
    display: {
      showDomain: true,
      showFolderPath: true,
      tintCards: false,
      tintStrength: 18,
    },
    folder: { mode: 'hidden', expandAll: false, rows: 2, child: null },
  },
  supports: {
    contentTopPercent: false,
    cardWidth: false,
    folderSetting: false,
    tintCards: false,
    sidebars: false,
  },
  vars(options: Record<string, ThemeOptionValue>) {
    const tone = TONES[String(options.tone)] ?? TONES.cool
    const transparency = Math.min(
      1,
      Math.max(0, Number(options.transparency ?? 12) / 100),
    )
    const alpha = 1 - transparency
    return {
      '--bnt-columns-ground-l': tone.light.ground,
      '--bnt-columns-sheet-l': tone.light.sheet,
      '--bnt-columns-ink-l': tone.light.ink,
      '--bnt-columns-ground-d': tone.dark.ground,
      '--bnt-columns-sheet-d': tone.dark.sheet,
      '--bnt-columns-ink-d': tone.dark.ink,
      '--bnt-columns-surface-a': String(alpha),
      // 表头略实于列面；透明度 100% 时两者都完全透明。
      '--bnt-columns-header-a': String(Math.min(1, alpha * (12 / 11))),
    }
  },
  Layout: ColumnsLayout,
}
