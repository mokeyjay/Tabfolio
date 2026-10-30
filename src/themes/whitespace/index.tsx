import type { ThemeDefinition, ThemeOptionValue } from '../types'
import { THEME_BACKGROUNDS } from '../backgrounds'
import { WhitespaceLayout } from './WhitespaceLayout'
import './whitespace.css'

/** 一档留白底色：页面兜底色、浮层面色、文字墨色。 */
type Tone = { ground: string; sheet: string; ink: string }

const TONES: Record<string, { light: Tone; dark: Tone }> = {
  warm: {
    light: { ground: '#f3f0e9', sheet: '253, 251, 247', ink: '42, 37, 30' },
    dark: { ground: '#191713', sheet: '32, 29, 25', ink: '243, 238, 229' },
  },
  cool: {
    light: { ground: '#eef1f5', sheet: '251, 252, 253', ink: '24, 30, 38' },
    dark: { ground: '#12151a', sheet: '25, 29, 35', ink: '232, 237, 244' },
  },
  neutral: {
    light: { ground: '#f2f2f0', sheet: '252, 252, 252', ink: '28, 28, 30' },
    dark: { ground: '#141415', sheet: '28, 28, 30', ink: '240, 240, 242' },
  },
}

export const whitespaceTheme: ThemeDefinition = {
  id: 'whitespace',
  name: (t) => t.theme.whitespaceName,
  description: (t) => t.theme.whitespaceDescription,
  options: [
    {
      key: 'tone',
      label: (t) => t.theme.whitespaceTone,
      type: 'select',
      default: 'warm',
      choices: [
        { value: 'warm', label: (t) => t.theme.whitespaceToneWarm },
        { value: 'cool', label: (t) => t.theme.whitespaceToneCool },
        { value: 'neutral', label: (t) => t.theme.whitespaceToneNeutral },
      ],
    },
    {
      key: 'transparency',
      label: (t) => t.theme.whitespaceTransparency,
      type: 'range',
      // 42% 透明 = 原设计 58% 不透明，换成直观说法但保持默认视觉。
      default: 42,
      min: 0,
      max: 100,
      step: 1,
      unit: '%',
    },
  ],
  recommends: {
    background: THEME_BACKGROUNDS.whitespace,
    radius: 8,
    shadow: 30,
    accent: '#7a5c46',
    layout: {
      // 留白布局只使用内容宽度与顶部位置，卡片尺寸会由能力声明禁用。
      cardWidth: 256,
      cardHeight: 64,
      maxContentWidth: 720,
      contentTopPercent: 12,
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
    cardWidth: false,
    cardHeight: false,
    tintCards: false,
    folderSetting: false,
    sidebars: false,
  },
  vars(options: Record<string, ThemeOptionValue>) {
    const tone = TONES[String(options.tone)] ?? TONES.warm
    const transparency = Math.min(
      1,
      Math.max(0, Number(options.transparency ?? 42) / 100),
    )
    return {
      '--bnt-whitespace-ground-l': tone.light.ground,
      '--bnt-whitespace-sheet-l': tone.light.sheet,
      '--bnt-whitespace-ink-l': tone.light.ink,
      '--bnt-whitespace-ground-d': tone.dark.ground,
      '--bnt-whitespace-sheet-d': tone.dark.sheet,
      '--bnt-whitespace-ink-d': tone.dark.ink,
      '--bnt-whitespace-backdrop-a': String(1 - transparency),
    }
  },
  Layout: WhitespaceLayout,
}
