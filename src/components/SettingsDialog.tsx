import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import {
  resetBackgroundSettings,
  resetSettings,
  setSyncEnabled,
  updateSettings,
  useSettingsState,
} from '../state/settingsStore'
import { DEFAULT_SETTINGS } from '../state/settingsSchema'
import { getSyncUsage } from '../platform/storage'
import { clearStats } from '../state/statsStore'
import { WallpaperSection } from './WallpaperSection'
import { NumberSetting, Switch } from './ui'
import { Tabs } from './Tabs'
import { IconClose } from './icons'
import { useDismiss } from '../hooks/useDismiss'
import { useModalA11y } from '../hooks/useModalA11y'
import { useMessages, type Messages } from '../i18n'
import type { Language } from '../types'
import { Segmented } from './ui'

type TabId = 'folder' | 'background' | 'advanced'

const TAB_IDS: TabId[] = ['folder', 'background', 'advanced']

function tabs(t: Messages): { id: TabId; label: string }[] {
  return [
    { id: 'folder', label: t.settings.tabFolder },
    { id: 'background', label: t.settings.tabBackground },
    { id: 'advanced', label: t.settings.tabAdvanced },
  ]
}

function languageOptions(t: Messages): { value: Language; label: string }[] {
  return [
    { value: 'auto', label: t.settings.languageAuto },
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
  ]
}

/**
 * 记住上次停在哪个 tab。
 *
 * 这是纯本机的界面状态，没必要占 storage.sync 的配额、更没必要同步到别的设备，
 * 所以直接写 localStorage —— 而且它必须是同步可读的，否则打开弹窗会先闪一下默认 tab。
 */
const TAB_KEY = 'bnt.settingsTab'

function readTab(): TabId {
  const saved = localStorage.getItem(TAB_KEY)
  return TAB_IDS.some((id) => id === saved) ? (saved as TabId) : 'folder'
}

function ResetCurrentTab({
  name,
  hint,
  message,
  onReset,
}: {
  name: string
  hint: string
  message?: string
  onReset: () => void | Promise<void>
}) {
  const { askConfirm, showToast } = useApp()
  const t = useMessages()
  return (
    <>
      <div className="bnt-divider" />
      <div className="bnt-row">
        <span className="bnt-hint">{hint}</span>
        <span className="bnt-spacer" />
        <button
          type="button"
          className="bnt-btn-ghost"
          onClick={() =>
            askConfirm({
              title: t.settings.resetPageTitle(name),
              message: message ?? t.settings.resetPageMessage(name),
              confirmLabel: t.common.reset,
              danger: true,
              onConfirm: async () => {
                await onReset()
                showToast(t.settings.resetDone(name))
              },
            })
          }
        >
          {t.settings.resetPage}
        </button>
      </div>
    </>
  )
}

function FolderTab() {
  const { settings } = useApp()
  const t = useMessages()
  return (
    <>
      <div className="bnt-group">
        <div className="bnt-group-title">{t.settings.batchOpen}</div>
        <NumberSetting
          label={t.settings.batchOpenLabel}
          value={settings.tabOpening.confirmThreshold}
          min={0}
          step={1}
          unit={t.settings.batchOpenUnit}
          onChange={(confirmThreshold) =>
            updateSettings((prev) => ({
              ...prev,
              tabOpening: { ...prev.tabOpening, confirmThreshold },
            }))
          }
        />
        <div className="bnt-hint">{t.settings.batchOpenHint}</div>
      </div>

      <ResetCurrentTab
        name={t.settings.folderName}
        hint={t.settings.folderHint}
        onReset={() =>
          updateSettings((p) => ({
            ...p,
            tabOpening: { ...DEFAULT_SETTINGS.tabOpening },
          }))
        }
      />
    </>
  )
}

function BackgroundTab() {
  const t = useMessages()
  return (
    <>
      <WallpaperSection />
      <ResetCurrentTab
        name={t.settings.backgroundName}
        hint={t.settings.backgroundHint}
        message={t.settings.backgroundMessage}
        onReset={resetBackgroundSettings}
      />
    </>
  )
}

function AdvancedTab() {
  const { settings, askConfirm, showToast } = useApp()
  const t = useMessages()
  const { error, newerVersion } = useSettingsState()
  const [css, setCss] = useState(settings.customCss)
  const [usage, setUsage] = useState<{ used: number; total: number } | null>(null)

  useEffect(() => {
    void getSyncUsage().then(setUsage).catch((error: unknown) => {
      console.error(t.settings.quotaFailed, error)
      setUsage(null)
    })
  }, [settings])

  const quota = usage
    ? `${(usage.used / 1024).toFixed(1)} / ${Math.round(usage.total / 1024)} KB`
    : null

  return (
    <>
      <div className="bnt-group">
        <div className="bnt-row">
          <span className="bnt-group-title">{t.settings.language}</span>
          <span className="bnt-spacer" />
          <Segmented
            value={settings.language}
            options={languageOptions(t)}
            onChange={(language) => updateSettings((p) => ({ ...p, language }))}
          />
        </div>
      </div>

      <div className="bnt-divider" />

      <div className="bnt-group">
        <div className="bnt-group-title">{t.settings.customCss}</div>
        <textarea
          className="bnt-textarea"
          value={css}
          spellCheck={false}
          placeholder={'.bnt-card { border-radius: 4px; }\n.bnt-sidebar { width: 300px; }'}
          onChange={(e) => setCss(e.target.value)}
          onBlur={() => updateSettings((p) => ({ ...p, customCss: css }))}
        />
      </div>

      <div className="bnt-divider" />

      <div className="bnt-group">
        <div className="bnt-group-title">{t.settings.sync}</div>
        <Switch
          on={settings.syncEnabled}
          label={t.settings.syncLabel}
          onChange={(v) => void setSyncEnabled(v)}
        />
        {quota && <span className="bnt-value" style={{ alignSelf: 'flex-end' }}>{quota}</span>}
        {newerVersion && <div className="bnt-error">{t.settings.newerVersion}</div>}
        {error && <div className="bnt-error">{error}</div>}
      </div>

      <div className="bnt-divider" />

      <div className="bnt-group">
        <div className="bnt-group-title">{t.settings.data}</div>
        <div className="bnt-row" style={{ gap: 8 }}>
          <button
            type="button"
            className="bnt-btn-ghost"
            onClick={() =>
              askConfirm({
                title: t.settings.clearStatsTitle,
                message: t.settings.clearStatsMessage,
                confirmLabel: t.settings.clearStatsConfirm,
                danger: true,
                onConfirm: async () => {
                  await clearStats()
                  showToast(t.settings.clearStatsDone)
                },
              })
            }
          >
            {t.settings.clearStats}
          </button>
        </div>
      </div>

      <ResetCurrentTab
        name={t.settings.advancedName}
        hint={t.settings.advancedHint}
        onReset={() => {
          updateSettings((p) => ({ ...p, customCss: DEFAULT_SETTINGS.customCss }))
          setCss(DEFAULT_SETTINGS.customCss)
        }}
      />

      <div className="bnt-divider" />

      <div className="bnt-group">
        <div className="bnt-group-title">{t.settings.allSettings}</div>
        <div className="bnt-row">
          <span className="bnt-hint">{t.settings.resetAllHint}</span>
          <span className="bnt-spacer" />
          <button
            type="button"
            className="bnt-btn-danger"
            onClick={() =>
              askConfirm({
                title: t.settings.resetAllTitle,
                message: t.settings.resetAllMessage,
                confirmLabel: t.settings.resetAll,
                danger: true,
                onConfirm: async () => {
                  await resetSettings()
                  setCss('')
                  showToast(t.settings.resetAllDone)
                },
              })
            }
          >
            {t.settings.resetAll}
          </button>
        </div>
      </div>
    </>
  )
}

export function SettingsDialog() {
  const { setSettingsOpen } = useApp()
  const t = useMessages()
  const [tab, setTab] = useState<TabId>(readTab)
  const selectTab = (id: TabId) => {
    setTab(id)
    localStorage.setItem(TAB_KEY, id)
  }
  const { closing, dismiss: close } = useDismiss(() => setSettingsOpen(false))
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y(overlayRef, dialogRef)

  return (
    <div ref={overlayRef} className={`bnt-overlay${closing ? ' is-closing' : ''}`} style={{ zIndex: 70 }} onMouseDown={close}>
      <div
        ref={dialogRef}
        className="bnt-dialog bnt-dialog-md bnt-dialog-tabbed bnt-glass"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={t.settings.title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bnt-dialog-top">
          <Tabs
            value={tab}
            options={tabs(t).map((item) => ({ value: item.id, label: item.label }))}
            onChange={selectTab}
          />
          <button
            type="button"
            className="bnt-iconbtn bnt-dialog-close"
            aria-label={t.common.close}
            onClick={close}
          >
            <IconClose size={15} />
          </button>
        </div>

        <div className="bnt-dialog-body" key={tab}>
          {tab === 'folder' && <FolderTab />}
          {tab === 'background' && <BackgroundTab />}
          {tab === 'advanced' && <AdvancedTab />}
        </div>
      </div>
    </div>
  )
}
