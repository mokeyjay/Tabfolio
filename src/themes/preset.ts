import type { FolderDisplaySetting, Settings } from '../types'
import type { Messages } from '../i18n'
import type { ThemeDefinition } from './types'
import { supportsFrameworkSetting } from './types'

/**
 * 主题推荐配置的套用与比对。
 *
 * 换主题时不擅自改用户调好的东西 —— 先把这套推荐值逐项摊开，用户勾哪项才应用哪项。
 * 主色、圆角、阴影这些明明是全局设置也列进来：主题只是「建议」它们该是什么，
 * 决定权仍在用户手里。明暗方案、壁纸、侧栏宽度跟主题气质无关，连推荐都不给。
 */

/** 推荐清单里的一行：这一项现在是什么、推荐成什么、会不会变 */
export interface RecommendationEntry {
  key: string
  label: string
  current: string
  next: string
  changed: boolean
  /** 值是颜色时界面会多画一个色点 */
  color?: { current: string; next: string }
}

/** 勾选集合；不给就是整套全应用 */
type Picked = ReadonlySet<string> | undefined

const took = (picked: Picked, key: string) => !picked || picked.has(key)

/** 按勾选把推荐配置套到设置上。没勾的项一律保持原样。 */
export function applyThemeRecommendation(
  theme: ThemeDefinition,
  prev: Settings,
  picked?: Picked,
): Settings {
  const r = theme.recommends
  const has = (key: string) => took(picked, key)
  const pick = <T,>(key: string, next: T, current: T): T => (has(key) ? next : current)
  const supported = (key: Parameters<typeof supportsFrameworkSetting>[1]) =>
    supportsFrameworkSetting(theme, key)

  return {
    ...prev,
    layout: {
      ...prev.layout,
      cardWidth: supported('cardWidth')
        ? pick('cardWidth', r.layout.cardWidth, prev.layout.cardWidth)
        : prev.layout.cardWidth,
      cardHeight: supported('cardHeight')
        ? pick('cardHeight', r.layout.cardHeight, prev.layout.cardHeight)
        : prev.layout.cardHeight,
      maxContentWidth: supported('maxContentWidth')
        ? pick('maxWidth', r.layout.maxContentWidth, prev.layout.maxContentWidth)
        : prev.layout.maxContentWidth,
      contentTopPercent: supported('contentTopPercent')
        ? pick('contentTop', r.layout.contentTopPercent, prev.layout.contentTopPercent)
        : prev.layout.contentTopPercent,
    },
    display: {
      showDomain: supported('showDomain')
        ? pick('showDomain', r.display.showDomain, prev.display.showDomain)
        : prev.display.showDomain,
      showFolderPath: supported('showFolderPath')
        ? pick('showFolderPath', r.display.showFolderPath, prev.display.showFolderPath)
        : prev.display.showFolderPath,
      // 染色开关和浓度是清单里的同一行，要换一起换
      tintCards: supported('tintCards')
        ? pick('tintCards', r.display.tintCards, prev.display.tintCards)
        : prev.display.tintCards,
      tintStrength: supported('tintCards')
        ? pick('tintCards', r.display.tintStrength, prev.display.tintStrength)
        : prev.display.tintStrength,
    },
    folder:
      !supported('folderSetting')
        ? prev.folder
        : has('folder')
          ? structuredClone(r.folder)
          : prev.folder,
    theme: {
      ...prev.theme,
      id: theme.id,
      accent: pick('accent', r.accent, prev.theme.accent),
      radius: pick('radius', r.radius, prev.theme.radius),
      shadow: pick('shadow', r.shadow, prev.theme.shadow),
      // 主题级设置属于用户为每套主题调好的状态，套用框架推荐配置不能顺手覆盖。
      // 需要恢复默认值时，交给主题选择器旁的显式重置操作处理。
      options: prev.theme.options,
    },
  }
}

const px = (value: number) => `${value} px`

function onOff(t: Messages, on: boolean): string {
  return on ? t.common.on : t.common.off
}

function maxWidthText(t: Messages, value: number): string {
  return value ? px(value) : t.display.maxWidthFull
}

const percent = (value: number) => `${value}%`

function tintText(t: Messages, d: Settings['display']): string {
  return d.tintCards ? `${t.common.on} · ${d.tintStrength}%` : t.common.off
}

/** 目录方案光有档位名不够 —— 展开几行、子目录是不是另设了，都得写出来才认得出差别 */
function folderText(t: Messages, f: FolderDisplaySetting): string {
  const parts = [t.folderSetting[f.mode]]
  if (f.mode === 'expanded') {
    parts.push(f.expandAll ? t.folderSetting.expandAll : `${f.rows} ${t.folderSetting.rowsUnit}`)
  }
  if (f.child) parts.push(t.folderSetting.childSet)
  return parts.join(' · ')
}

/**
 * 把推荐配置逐项摊成「当前 → 推荐」。
 *
 * 全部列出来而不是只列有变化的：用户要判断的是「这套推荐值合不合我意」，
 * 只给差异项就看不出这套配置的全貌了。
 */
export function recommendationEntries(
  theme: ThemeDefinition,
  s: Settings,
  t: Messages,
): RecommendationEntry[] {
  const r = theme.recommends
  const entry = (key: string, label: string, current: string, next: string) => ({
    key,
    label,
    current,
    next,
    changed: current !== next,
  })

  const supported = (key: Parameters<typeof supportsFrameworkSetting>[1]) =>
    supportsFrameworkSetting(theme, key)

  return [
    {
      ...entry('accent', t.display.accent, s.theme.accent, r.accent),
      color: { current: s.theme.accent, next: r.accent },
    },
    entry('radius', t.display.radius, px(s.theme.radius), px(r.radius)),
    entry('shadow', t.display.shadow, `${s.theme.shadow}%`, `${r.shadow}%`),
    ...(supported('cardWidth')
      ? [
          entry('cardWidth', t.display.cardWidth, px(s.layout.cardWidth), px(r.layout.cardWidth)),
        ]
      : []),
    ...(supported('cardHeight')
      ? [entry('cardHeight', t.display.cardHeight, px(s.layout.cardHeight), px(r.layout.cardHeight))]
      : []),
    ...(supported('maxContentWidth')
      ? [entry(
          'maxWidth',
          t.display.maxWidthShort,
          maxWidthText(t, s.layout.maxContentWidth),
          maxWidthText(t, r.layout.maxContentWidth),
        )]
      : []),
    ...(supported('contentTopPercent')
      ? [entry(
          'contentTop',
          t.display.contentTop,
          percent(s.layout.contentTopPercent),
          percent(r.layout.contentTopPercent),
        )]
      : []),
    ...(supported('showDomain')
      ? [entry('showDomain', t.display.showDomain, onOff(t, s.display.showDomain), onOff(t, r.display.showDomain))]
      : []),
    ...(supported('showFolderPath')
      ? [entry(
          'showFolderPath',
          t.display.showFolderPath,
          onOff(t, s.display.showFolderPath),
          onOff(t, r.display.showFolderPath),
        )]
      : []),
    ...(supported('tintCards')
      ? [entry('tintCards', t.display.tintCards, tintText(t, s.display), tintText(t, r.display))]
      : []),
    ...(supported('folderSetting')
      ? [entry('folder', t.folderSetting.label, folderText(t, s.folder), folderText(t, r.folder))]
      : []),
  ]
}
