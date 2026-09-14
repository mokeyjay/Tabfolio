import { useEffect } from 'react'
import { useApp } from './AppContext'
import { DragProvider } from './DragProvider'
import { setLanguage, useMessages } from '../i18n'
import { getTheme, themeOptionsOf } from '../themes/registry'
import { layoutVars } from '../utils/metrics'
import { hexToRgb } from '../utils/color'
import { Background } from '../components/Background'
import { ContextMenu } from '../components/ContextMenu'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EditDialog } from '../components/EditDialog'
import { SettingsDialog } from '../components/SettingsDialog'
import { useDismiss } from '../hooks/useDismiss'

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  const { closing, dismiss } = useDismiss(onClose, { escape: false })

  useEffect(() => {
    const timer = setTimeout(dismiss, 2600)
    return () => clearTimeout(timer)
  }, [dismiss])

  return (
    <div className={`bnt-toast bnt-glass${closing ? ' is-closing' : ''}`} role="status">
      {message}
    </div>
  )
}

/** 用户的自定义 CSS 挂在一个独立的 style 标签里，永远排在主题样式之后 */
function useCustomCss(css: string) {
  useEffect(() => {
    const id = 'bnt-custom-css'
    let el = document.getElementById(id) as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = id
      document.head.append(el)
    }
    el.textContent = css
  }, [css])
}

export function App() {
  const { settings, ready, editNode, settingsOpen, toast, menu, confirm, closeToast } = useApp()
  const theme = getTheme(settings.theme.id)
  const themeOptions = themeOptionsOf(theme, settings.theme.options[theme.id])
  const t = useMessages()

  useCustomCss(settings.customCss)

  useEffect(() => setLanguage(settings.language), [settings.language])

  // 主题变量挂在 documentElement 上，这样弹层(portal 之外的 fixed 元素)也吃得到
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme.id

    const { accent, scheme } = settings.theme
    if (scheme === 'auto') delete root.dataset.scheme
    else root.dataset.scheme = scheme

    const rgb = hexToRgb(accent)
    const vars = {
      // 主色是全局的，不归任何主题所有
      '--bnt-accent': accent,
      '--bnt-accent-rgb': rgb,
      '--bnt-accent-soft': `rgba(${rgb},.12)`,
      '--bnt-accent-glow': `rgba(${rgb},.3)`,
      ...theme.vars(themeOptions),
      ...layoutVars(settings),
    }
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, String(v))
  }, [theme, themeOptions, settings])

  const { Layout } = theme

  return (
    <>
      <Background />
      {ready ? (
        <DragProvider>
          <Layout />
        </DragProvider>
      ) : (
        <div className="bnt-boot">{t.boot.loading}</div>
      )}
      {editNode && <EditDialog key={editNode.id} />}
      {settingsOpen && <SettingsDialog />}
      {/* 这两个必须条件挂载：常驻的话 useDismiss 的 closing 会留在上次关闭的状态 */}
      {menu?.node && <ContextMenu />}
      {confirm && <ConfirmDialog />}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          onClose={() => closeToast(toast.id)}
        />
      )}
    </>
  )
}
