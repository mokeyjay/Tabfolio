import type { ThemeDefinition, ThemeOptionValue } from './types'
import { defaultThemeOptions } from './types'
import { glassTheme } from './glass'
import { acrylicTheme } from './acrylic'
import { paperTheme } from './paper'
import { whitespaceTheme } from './whitespace'
import { columnsTheme } from './columns'
import { columnarTheme } from './columnar'

/**
 * 主题注册表。新增一个主题 = 写一个 ThemeDefinition 再往这里加一行，
 * 设置面板里的主题列表和主题配置项都是从这里读出来自动渲染的。
 */
export const THEMES: ThemeDefinition[] = [
  glassTheme,
  acrylicTheme,
  paperTheme,
  whitespaceTheme,
  columnsTheme,
  columnarTheme,
]

export const DEFAULT_THEME_ID = glassTheme.id

export function getTheme(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? glassTheme
}

/** 取这套主题的配置；缺少的字段取当前默认值，已经保存的字段仍以用户设置为准 */
export function themeOptionsOf(
  theme: ThemeDefinition,
  stored: Record<string, ThemeOptionValue> | undefined,
): Record<string, ThemeOptionValue> {
  return { ...defaultThemeOptions(theme), ...stored }
}
