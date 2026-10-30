import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../app/AppContext'
import {
  resetBackgroundSettings,
  resetSettings,
  setSyncEnabled,
  updateSettings,
  updateSettingsNow,
  useSettingsState,
} from '../state/settingsStore'
import { DEFAULT_SETTINGS } from '../state/settingsSchema'
import { getSyncUsage } from '../platform/storage'
import { clearStats } from '../state/statsStore'
import { WallpaperSection } from './WallpaperSection'
import { Switch } from './ui'
import { Tabs } from './Tabs'
import { IconClose } from './icons'
import { useDismiss } from '../hooks/useDismiss'
import { useDraggableWindow } from '../hooks/useDraggableWindow'
import { BackgroundDisplayTab, ContentDisplayTab, LayoutDisplayTab, ThemeDisplayTab } from './DisplaySettingsTabs'
import { resolveLanguage, useMessages, type Messages } from '../i18n'
import type { Language } from '../types'
import { Segmented } from './ui'

type TabId = 'layout' | 'content' | 'background' | 'theme' | 'advanced'

const TAB_IDS: TabId[] = ['layout', 'content', 'background', 'theme', 'advanced']

function tabs(t: Messages): { id: TabId; label: string }[] {
  return [
    { id: 'layout', label: t.display.tabLayout },
    { id: 'content', label: t.display.tabContent },
    { id: 'background', label: t.display.tabBackground },
    { id: 'theme', label: t.display.tabTheme },
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
  return TAB_IDS.some((id) => id === saved) ? (saved as TabId) : 'layout'
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

function BackgroundTab() {
  const t = useMessages()
  return (
    <>
      <WallpaperSection />
      <div className="bnt-divider" />
      <BackgroundDisplayTab />
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
          value={settings.customCss}
          spellCheck={false}
          placeholder={'.bnt-card { border-radius: 4px; }\n.bnt-sidebar { width: 300px; }'}
          onChange={(event) => updateSettings((prev) => ({ ...prev, customCss: event.target.value }))}
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

      <div className="bnt-divider" />

      <div className="bnt-group">
        <div className="bnt-group-title">{t.settings.privacyPolicy}</div>
        <div className="bnt-row" style={{ gap: 8 }}>
          <span className="bnt-hint">{t.settings.privacyPolicyHint}</span>
          <span className="bnt-spacer" />
          <a
            className="bnt-btn-ghost"
            href={`newtab.html?privacy&lang=${resolveLanguage(settings.language)}`}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              event.preventDefault()
              const href = event.currentTarget.href
              // 跳转会卸载当前页面，先保存仍在防抖等待中的外观修改。
              void updateSettingsNow((current) => current).then(
                () => location.assign(href),
                (error: unknown) => showToast(t.settings.saveFailed(error instanceof Error ? error.message : String(error))),
              )
            }}
          >
            {t.settings.openPrivacyPolicy}
          </a>
        </div>
      </div>

      <ResetCurrentTab
        name={t.settings.advancedName}
        hint={t.settings.advancedHint}
        onReset={() => {
          updateSettings((p) => ({ ...p, customCss: DEFAULT_SETTINGS.customCss }))
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

/** 无遮罩的设置窗口：页面仍可操作，修改即时预览，点击外部不会关闭。 */
export function SettingsDialog() {
  const { setSettingsOpen, menu } = useApp()
  const t = useMessages()
  const [tab, setTab] = useState<TabId>(readTab)
  const selectTab = (id: TabId) => {
    setTab(id)
    localStorage.setItem(TAB_KEY, id)
  }
  const { closing, dismiss: close } = useDismiss(() => setSettingsOpen(false), { escape: false })
  const windowRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const { position, dragging, handleProps } = useDraggableWindow(windowRef)

  useLayoutEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const restoreFocusRing = previousFocus?.matches(':focus-visible') ?? false
    const dialog = dialogRef.current
    dialog?.focus()
    return () => {
      // 用户已经转去操作页面时，关闭设置不应抢回焦点。
      if (!dialog?.contains(document.activeElement)) return
      const target = previousFocus?.isConnected
        ? previousFocus
        : document.querySelector<HTMLButtonElement>('.bnt-settings-trigger')
      // 鼠标打开时只恢复焦点，不沿用 Esc 产生的键盘焦点环。
      if (!restoreFocusRing && target?.matches('.bnt-settings-trigger')) target.setAttribute('data-restored-focus', '')
      target?.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // 确认框、渐变编辑器和菜单优先处理 Esc，不能连带关闭设置窗口。
      if (event.key !== 'Escape' || event.defaultPrevented || menu || document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, menu])

  return (
    <div
      ref={windowRef}
      id="bnt-settings-window"
      className={`bnt-settings-window${closing ? ' is-closing' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
    >
      <div
        ref={dialogRef}
        className="bnt-dialog bnt-dialog-tabbed bnt-glass"
        role="dialog"
        tabIndex={-1}
        aria-label={t.settings.title}
      >
        <div className="bnt-settings-titlebar">
          <button
            type="button"
            className="bnt-settings-drag-handle"
            aria-label={t.settings.moveWindow}
            title={t.settings.moveWindowHint}
            {...handleProps}
          >
            <span>{t.settings.title}</span>
          </button>
          <button type="button" className="bnt-iconbtn" aria-label={t.common.close} onClick={close}>
            <IconClose size={17} />
          </button>
        </div>
        <div className="bnt-settings-tabs">
          <Tabs value={tab} options={tabs(t).map((item) => ({ value: item.id, label: item.label }))} onChange={selectTab} />
        </div>
        <div className="bnt-dialog-body" key={tab}>
          {tab === 'layout' && <LayoutDisplayTab />}
          {tab === 'content' && <ContentDisplayTab />}
          {tab === 'background' && <BackgroundTab />}
          {tab === 'theme' && <ThemeDisplayTab />}
          {tab === 'advanced' && <AdvancedTab />}
        </div>
      </div>
    </div>
  )
}
