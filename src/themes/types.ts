import type { ComponentType } from 'react'
import type { Messages } from '../i18n/en'
import type { FolderDisplaySetting, Settings } from '../types'

/** 文案不写死在主题里，渲染时按当前语言取 */
type Label = (t: Messages) => string

export type ThemeOptionValue = string | number | boolean

/** 设置面板里由框架统一提供、但不同布局未必都有实际含义的设置。 */
export type FrameworkSettingKey =
  | 'maxContentWidth'
  | 'contentTopPercent'
  | 'cardWidth'
  | 'cardHeight'
  | 'showDomain'
  | 'showFolderPath'
  | 'folderSetting'
  | 'tintCards'
  | 'sidebars'

export type ThemeOptionDef =
  | { key: string; label: Label; type: 'color'; default: string; hint?: string; presets?: string[] }
  | {
      key: string
      label: Label
      type: 'range'
      default: number
      min: number
      max: number
      step: number
      unit?: string
      hint?: string
    }
  | {
      key: string
      label: Label
      type: 'select'
      default: string
      choices: { value: string; label: Label }[]
      hint?: string
    }
  | { key: string; label: Label; type: 'boolean'; default: boolean; hint?: string }

/**
 * 主题推荐的一套视觉配置。
 *
 * 主题只能决定自己那套变量，但「多大的圆角、多重的阴影、什么主色、卡片多大」这些
 * 是全局设置 —— 每套主题都有一组和它气质相配的值。换主题时把这套推荐值逐项摊给
 * 用户，勾哪项应用哪项(见 themes/preset.ts)，一项都不勾就等于什么都没动。
 *
 * 主色列在这里不代表它归主题所有：它照旧是全局设置，只有用户勾了才会被换掉。
 * 明暗方案和壁纸连推荐都不给 —— 那是环境和个人偏好，跟主题气质无关。
 */
export interface ThemeRecommendation {
  /** 面板圆角，px */
  radius: number
  /** 阴影浓度，% */
  shadow: number
  /** 推荐主色，hex */
  accent: string
  layout: Pick<
    Settings['layout'],
    'cardWidth' | 'cardHeight' | 'maxContentWidth' | 'contentTopPercent'
  >
  display: Settings['display']
  folder: FolderDisplaySetting
}

/**
 * 一个主题 = 一套 CSS 变量 + 一套布局组件。
 *
 * 主题不只是换色，还包括布局：换主题时整个页面骨架都可以通过 `Layout` 换成另一套
 * 组件组合，而具体的书签卡片、目录树等在 components/ 下复用。新增主题只需要在
 * registry 里多注册一项。
 *
 * 主色和明暗方案**不在**这里 —— 它们是全局设置，所有主题共用，换主题不会丢。
 * 主题只负责自己那套样式参数(毛玻璃主题就是模糊度和不透明度)。
 */
export interface ThemeDefinition {
  id: string
  name: Label
  description: Label
  options: ThemeOptionDef[]
  /** 换到这套主题时推荐的全局视觉配置 */
  recommends: ThemeRecommendation
  /** 主题骨架实际支持的框架配置。未声明的设置默认支持。 */
  supports?: Partial<Record<FrameworkSettingKey, boolean>>
  /** 主题自己的配置项 -> 挂到 :root 上的 CSS 变量 */
  vars(options: Record<string, ThemeOptionValue>): Record<string, string>
  Layout: ComponentType
}

/** 未声明即支持，保证新增能力时旧主题不会被意外禁用。 */
export function supportsFrameworkSetting(
  theme: ThemeDefinition,
  key: FrameworkSettingKey,
): boolean {
  return theme.supports?.[key] !== false
}

export function defaultThemeOptions(
  theme: ThemeDefinition,
): Record<string, ThemeOptionValue> {
  const out: Record<string, ThemeOptionValue> = {}
  for (const o of theme.options) out[o.key] = o.default
  return out
}
