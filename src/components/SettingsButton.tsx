import { useApp } from '../app/AppContext'
import { useMessages } from '../i18n'
import { IconSettings } from './icons'

/** 所有主题共用同一个设置入口，弹窗挂在应用层，换主题时仍保持打开。 */
export function SettingsButton() {
  const { settingsOpen, setSettingsOpen } = useApp()
  const t = useMessages()
  return (
    <button
      type="button"
      className={`bnt-iconbtn bnt-iconbtn-lg bnt-settings-trigger${settingsOpen ? ' is-on' : ''}`}
      title={t.settings.title}
      aria-label={t.settings.title}
      aria-haspopup="dialog"
      aria-expanded={settingsOpen}
      aria-controls={settingsOpen ? 'bnt-settings-window' : undefined}
      onBlur={(event) => event.currentTarget.removeAttribute('data-restored-focus')}
      onKeyDown={(event) => event.currentTarget.removeAttribute('data-restored-focus')}
      onPointerDown={(event) => event.currentTarget.removeAttribute('data-restored-focus')}
      onClick={() => setSettingsOpen(true)}
    >
      <IconSettings size={17} />
    </button>
  )
}
