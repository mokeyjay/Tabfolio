import type { ThemeDefinition, ThemeOptionValue } from '../types'
import { ColumnarLayout } from './ColumnarLayout'
import './columnar.css'

type Tone = { ground: string; sheet: string; ink: string }

const TONES: Record<string, { light: Tone; dark: Tone }> = {
  neutral: {
    light: { ground: '#f2f2f0', sheet: '252, 252, 251', ink: '28, 28, 30' },
    dark: { ground: '#141415', sheet: '26, 26, 27', ink: '240, 240, 242' },
  },
  cool: {
    light: { ground: '#eef1f5', sheet: '251, 252, 253', ink: '24, 30, 38' },
    dark: { ground: '#12151a', sheet: '24, 28, 34', ink: '232, 237, 244' },
  },
  warm: {
    light: { ground: '#f3f0e9', sheet: '253, 251, 247', ink: '42, 37, 30' },
    dark: { ground: '#191713', sheet: '31, 28, 24', ink: '243, 238, 229' },
  },
}

export const columnarTheme: ThemeDefinition = {
  id: 'columnar',
  name: (t) => t.theme.columnarName,
  description: (t) => t.theme.columnarDescription,
  options: [
    {
      key: 'tone',
      label: (t) => t.theme.columnarTone,
      type: 'select',
      default: 'neutral',
      choices: [
        { value: 'neutral', label: (t) => t.theme.columnarToneNeutral },
        { value: 'cool', label: (t) => t.theme.columnarToneCool },
        { value: 'warm', label: (t) => t.theme.columnarToneWarm },
      ],
    },
    {
      key: 'transparency',
      label: (t) => t.theme.columnarTransparency,
      type: 'range',
      // 和列栏保持同一套默认视觉：12% 透明，即 88% 的主题底色。
      default: 12,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    },
    {
      key: 'rows',
      label: (t) => t.theme.columnarRows,
      type: 'range',
      default: 6,
      min: 4,
      max: 12,
      step: 1,
    },
  ],
  recommends: {
    radius: 8,
    shadow: 20,
    accent: '#3f5d7d',
    layout: {
      cardWidth: 300,
      cardHeight: 36,
      maxContentWidth: 1320,
      // 顶栏属于主题骨架，内容起点由其高度和主题内边距共同决定。
      contentTopPercent: 0,
    },
    display: {
      showDomain: true,
      // 分栏摊平目录后必须常驻祖先路径，否则同名目录无法区分。
      showFolderPath: true,
      tintCards: false,
      tintStrength: 18,
    },
    folder: { mode: 'hidden', expandAll: false, rows: 2, child: null },
  },
  supports: {
    contentTopPercent: false,
    showFolderPath: false,
    folderSetting: false,
    tintCards: false,
    sidebars: false,
  },
  vars(options: Record<string, ThemeOptionValue>) {
    const tone = TONES[String(options.tone)] ?? TONES.neutral
    const transparency = Math.min(
      1,
      Math.max(0, Number(options.transparency ?? 12) / 100),
    )
    const alpha = 1 - transparency
    return {
      '--bnt-columnar-ground-l': tone.light.ground,
      '--bnt-columnar-sheet-l': tone.light.sheet,
      '--bnt-columnar-ink-l': tone.light.ink,
      '--bnt-columnar-ground-d': tone.dark.ground,
      '--bnt-columnar-sheet-d': tone.dark.sheet,
      '--bnt-columnar-ink-d': tone.dark.ink,
      '--bnt-columnar-ground-a': String(alpha),
      // 顶栏略实于内容底色；100% 透明时两者都完全透明。
      '--bnt-columnar-toolbar-a': String(Math.min(1, alpha * (12 / 11))),
    }
  },
  Layout: ColumnarLayout,
}
