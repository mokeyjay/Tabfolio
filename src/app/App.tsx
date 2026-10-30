import { useEffect } from 'react'
import { useApp } from './AppContext'
import { DragProvider } from './DragProvider'
import { setLanguage, useMessages } from '../i18n'
import { useAppearance } from '../hooks/useAppearance'
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

export function App() {
  const { settings, ready, editNode, settingsOpen, toast, menu, confirm, closeToast } = useApp()
  const theme = useAppearance(settings)
  const t = useMessages()

  useEffect(() => setLanguage(settings.language), [settings.language])

  const { Layout } = theme

  return (
    <>
      <Background settings={settings} />
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
