import { useLayoutEffect } from 'react'
import type { Settings } from '../types'
import { getTheme, themeOptionsOf } from '../themes/registry'
import { layoutVars } from '../utils/metrics'
import { hexToRgb } from '../utils/color'

/** 欢迎页与书签页共用外观设置，首次绘制前应用主题，避免颜色闪变。 */
export function useAppearance(settings: Settings) {
  const theme = getTheme(settings.theme.id)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme.id
    const { accent, scheme } = settings.theme
    if (scheme === 'auto') delete root.dataset.scheme
    else root.dataset.scheme = scheme

    const rgb = hexToRgb(accent)
    const options = themeOptionsOf(theme, settings.theme.options[theme.id])
    const vars = {
      '--bnt-accent': accent,
      '--bnt-accent-rgb': rgb,
      '--bnt-accent-soft': `rgba(${rgb},.12)`,
      '--bnt-accent-glow': `rgba(${rgb},.3)`,
      ...theme.vars(options),
      ...layoutVars(settings),
    }
    for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, String(value))

    // 自定义 CSS 始终排在主题样式之后，欢迎页也遵循同一份外观配置。
    let customStyle = document.getElementById('bnt-custom-css') as HTMLStyleElement | null
    if (!customStyle) {
      customStyle = document.createElement('style')
      customStyle.id = 'bnt-custom-css'
      document.head.append(customStyle)
    }
    customStyle.textContent = settings.customCss
  }, [settings, theme])

  return theme
}
