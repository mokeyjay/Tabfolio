import { useState, type ReactNode } from 'react'
import type { FrameworkSettingKey, ThemeDefinition, ThemeOptionValue } from '../themes/types'
import { defaultThemeOptions, supportsFrameworkSetting } from '../themes/types'
import type { BackgroundFit, ColorScheme } from '../types'
import { useApp } from '../app/AppContext'
import { updateSettings } from '../state/settingsStore'
import {
  DEFAULT_SETTINGS,
  clampFolderSetting,
} from '../state/settingsSchema'
import { THEMES, getTheme, themeOptionsOf } from '../themes/registry'
import { addAccentColor, removeAccentColor, resetAccentPalette, useAccentPalette } from '../state/accentPaletteStore'
import {
  applyThemeRecommendation,
  recommendationEntries,
  type RecommendationEntry,
} from '../themes/preset'
import { useMessages, type Messages } from '../i18n'
import { FolderSettingEditor } from './FolderSettingEditor'
import { ColorField, IconButton, NumberSetting, Segmented, Slider, Switch } from './ui'
import { IconCheck, IconClose, IconRestore } from './icons'

function fitModes(t: Messages): { value: BackgroundFit; label: string }[] {
  return [
    { value: 'cover', label: t.display.fitCover },
    { value: 'contain', label: t.display.fitContain },
    { value: 'stretch', label: t.display.fitStretch },
    { value: 'tile', label: t.display.fitTile },
  ]
}

function ResetDisplayTab({ onReset }: { onReset: () => void | Promise<void> }) {
  const { showToast } = useApp()
  const t = useMessages()
  return (
    <div className="bnt-display-reset">
      <span>{t.display.resetTabHint}</span>
      <button
        type="button"
        className="bnt-btn-ghost"
        onClick={async () => {
          try {
            await onReset()
            showToast(t.display.resetDone)
          } catch (error) {
            showToast(t.settings.saveFailed(error instanceof Error ? error.message : String(error)))
          }
        }}
      >
        {t.display.resetTab}
      </button>
    </div>
  )
}

/**
 * 无效项仍留在原位，方便用户理解这是主题能力差异；禁用态同时提供原因说明。
 */
function FrameworkSetting({
  setting,
  children,
}: {
  setting: FrameworkSettingKey
  children: ReactNode
}) {
  const { settings } = useApp()
  const t = useMessages()
  const theme = getTheme(settings.theme.id)
  const supported = supportsFrameworkSetting(theme, setting)

  return (
    <div
      className={`bnt-framework-setting${supported ? '' : ' is-disabled'}`}
      aria-disabled={!supported || undefined}
      data-tooltip={supported ? undefined : t.display.unsupportedSetting(theme.name(t))}
      tabIndex={supported ? undefined : 0}
    >
      {children}
    </div>
  )
}

export function LayoutDisplayTab() {
  const { settings } = useApp()
  const t = useMessages()
  const { layout } = settings
  const theme = getTheme(settings.theme.id)
  const supported = (key: FrameworkSettingKey) => supportsFrameworkSetting(theme, key)
  return (
    <>
      <div className="bnt-group">
        <FrameworkSetting setting="maxContentWidth">
          <NumberSetting
            label={t.display.maxWidth}
            value={layout.maxContentWidth}
            min={0}
            step={1}
            unit="px"
            onChange={(maxContentWidth) =>
              updateSettings((prev) => ({ ...prev, layout: { ...prev.layout, maxContentWidth } }))
            }
          />
        </FrameworkSetting>
      </div>

      <div className="bnt-divider" />

      <div className="bnt-group">
        <FrameworkSetting setting="contentTopPercent">
          <Slider
            label={t.display.contentTop}
            value={layout.contentTopPercent}
            min={0}
            max={100}
            step={1}
            display={`${layout.contentTopPercent}%`}
            onChange={(contentTopPercent) =>
              updateSettings((prev) => ({
                ...prev,
                layout: { ...prev.layout, contentTopPercent },
              }))
            }
          />
        </FrameworkSetting>
      </div>

      <div className="bnt-divider" />

      <div className="bnt-group">
        <div className="bnt-group-title">{t.display.cards}</div>
        <FrameworkSetting setting="cardWidth">
          <Slider
            label={t.display.cardWidth}
            value={layout.cardWidth}
            min={96}
            max={800}
            step={4}
            display={`${layout.cardWidth} px`}
            onChange={(cardWidth) =>
              updateSettings((prev) => ({ ...prev, layout: { ...prev.layout, cardWidth } }))
            }
          />
        </FrameworkSetting>
        <FrameworkSetting setting="cardHeight">
          <Slider
            label={t.display.cardHeight}
            value={layout.cardHeight}
            min={32}
            max={200}
            step={4}
            display={`${layout.cardHeight} px`}
            onChange={(cardHeight) =>
              updateSettings((prev) => ({ ...prev, layout: { ...prev.layout, cardHeight } }))
            }
          />
        </FrameworkSetting>
      </div>

      <ResetDisplayTab
        onReset={() =>
          updateSettings((prev) => ({
            ...prev,
            layout: {
              maxContentWidth: supported('maxContentWidth')
                ? DEFAULT_SETTINGS.layout.maxContentWidth
                : prev.layout.maxContentWidth,
              contentTopPercent: supported('contentTopPercent')
                ? DEFAULT_SETTINGS.layout.contentTopPercent
                : prev.layout.contentTopPercent,
              cardWidth: supported('cardWidth')
                ? DEFAULT_SETTINGS.layout.cardWidth
                : prev.layout.cardWidth,
              cardHeight: supported('cardHeight')
                ? DEFAULT_SETTINGS.layout.cardHeight
                : prev.layout.cardHeight,
            },
          }))
        }
      />
    </>
  )
}

export function ContentDisplayTab() {
  const { settings } = useApp()
  const t = useMessages()
  const { display } = settings
  const theme = getTheme(settings.theme.id)
  const supported = (key: FrameworkSettingKey) => supportsFrameworkSetting(theme, key)
  return (
    <>
      <div className="bnt-group bnt-display-switches">
        <div className="bnt-group-title">{t.display.showItems}</div>
        <FrameworkSetting setting="showDomain">
          <Switch
            on={display.showDomain}
            label={t.display.showDomain}
            onChange={(showDomain) =>
              updateSettings((prev) => ({ ...prev, display: { ...prev.display, showDomain } }))
            }
          />
        </FrameworkSetting>
        <FrameworkSetting setting="showFolderPath">
          <Switch
            on={display.showFolderPath}
            label={t.display.showFolderPath}
            onChange={(showFolderPath) =>
              updateSettings((prev) => ({ ...prev, display: { ...prev.display, showFolderPath } }))
            }
          />
        </FrameworkSetting>
      </div>

      <div className="bnt-divider" />

      <FrameworkSetting setting="folderSetting">
        <FolderSettingEditor
          value={settings.folder}
          onChange={(folder) =>
            updateSettings((prev) => ({ ...prev, folder: clampFolderSetting(folder) }))
          }
        />
      </FrameworkSetting>

      <div className="bnt-divider" />
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

      {/* 卡片染色跟着主题走(在主题页)，这里的重置就别越界去动它 */}
      <ResetDisplayTab
        onReset={() =>
          updateSettings((prev) => ({
            ...prev,
            display: {
              ...prev.display,
              showDomain: supported('showDomain')
                ? DEFAULT_SETTINGS.display.showDomain
                : prev.display.showDomain,
              showFolderPath: supported('showFolderPath')
                ? DEFAULT_SETTINGS.display.showFolderPath
                : prev.display.showFolderPath,
            },
            folder: supported('folderSetting') ? { ...DEFAULT_SETTINGS.folder } : prev.folder,
            tabOpening: { ...DEFAULT_SETTINGS.tabOpening },
          }))
        }
      />
    </>
  )
}

export function BackgroundDisplayTab() {
  const { settings } = useApp()
  const t = useMessages()
  const background = settings.background
  const patch = (next: Partial<typeof background>) =>
    updateSettings((prev) => ({
      ...prev,
      background: { ...prev.background, ...next },
    }))

  return (
    <>
      <div className="bnt-group">
        <div className="bnt-row">
          <span className="bnt-group-title">{t.display.fit}</span>
          <span className="bnt-spacer" />
          <Segmented value={background.fit} options={fitModes(t)} onChange={(fit) => patch({ fit })} />
        </div>
      </div>

      <div className="bnt-divider" />

      <div className="bnt-group">
        <div className="bnt-group-title">{t.display.wallpaperEffects}</div>
        <Slider
          label={t.display.wallpaperBlur}
          value={background.blur}
          min={0}
          max={100}
          step={1}
          display={`${background.blur} px`}
          onChange={(blur) => patch({ blur })}
        />
        <Slider
          label={t.display.wallpaperDim}
          value={background.dim}
          min={0}
          max={100}
          step={1}
          display={`${background.dim}%`}
          onChange={(dim) => patch({ dim })}
        />
      </div>


    </>
  )
}

function ThemeOptions({
  theme,
  values,
  onChange,
}: {
  theme: ThemeDefinition
  values: Record<string, ThemeOptionValue>
  onChange: (key: string, value: ThemeOptionValue) => void
}) {
  const t = useMessages()
  return (
    <div className="bnt-group">
      {theme.options.map((option) => {
        if (option.type === 'range') {
          return (
            <Slider
              key={option.key}
              label={option.label(t)}
              value={Number(values[option.key])}
              min={option.min}
              max={option.max}
              step={option.step}
              display={`${values[option.key]}${option.unit ?? ''}`}
              onChange={(value) => onChange(option.key, value)}
            />
          )
        }
        if (option.type === 'color') {
          const current = String(values[option.key])
          return (
            <div className="bnt-group" key={option.key}>
              <span className="bnt-label">{option.label(t)}</span>
              <div className="bnt-swatches">
                {(option.presets ?? []).map((color) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={color}
                    className={`bnt-swatch${color === current ? ' is-on' : ''}`}
                    style={{ background: color, color }}
                    onClick={() => onChange(option.key, color)}
                  />
                ))}
                <ColorField
                  variant="custom"
                  label={t.display.customOption(option.label(t))}
                  active={!(option.presets ?? []).includes(current)}
                  value={current}
                  onChange={(value) => onChange(option.key, value)}
                />
              </div>
            </div>
          )
        }
        if (option.type === 'select') {
          return (
            <div className="bnt-row" key={option.key}>
              <span className="bnt-label">{option.label(t)}</span>
              <span className="bnt-spacer" />
              <Segmented
                value={String(values[option.key])}
                options={option.choices.map((choice) => ({ value: choice.value, label: choice.label(t) }))}
                onChange={(value) => onChange(option.key, value)}
              />
            </div>
          )
        }
        return (
          <Switch
            key={option.key}
            on={Boolean(values[option.key])}
            label={option.label(t)}
            onChange={(value) => onChange(option.key, value)}
          />
        )
      })}
    </div>
  )
}

/** 清单里的一个色点 —— 主色这类值光看 hex 认不出来 */
function ColorDot({ value }: { value: string }) {
  return <span className="bnt-recommend-dot" style={{ background: value }} />
}

/**
 * 换主题时摆在确认框里的推荐配置清单。
 *
 * 全部项都列，会变的那几行画成「当前 → 推荐」并默认勾上 —— 用户既看得到这套配置的
 * 全貌，也能只挑自己想要的那几项。勾选结果写回 selection，确认时由外面读走。
 */
function RecommendationList({
  theme,
  entries,
  selection,
}: {
  theme: ThemeDefinition
  entries: RecommendationEntry[]
  selection: { current: ReadonlySet<string> }
}) {
  const t = useMessages()
  const [picked, setPicked] = useState(selection.current)

  const toggle = (key: string) => {
    const next = new Set(picked)
    if (!next.delete(key)) next.add(key)
    selection.current = next
    setPicked(next)
  }

  return (
    <>
      <p className="bnt-recommend-lead">{t.display.recommendMessage(theme.name(t))}</p>
      <ul className="bnt-recommend">
        {entries.map((entry) => {
          const on = picked.has(entry.key)
          return (
            <li key={entry.key}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                className={`bnt-recommend-row${on ? ' is-on' : ''}`}
                onClick={() => toggle(entry.key)}
              >
                <span className="bnt-check" aria-hidden>
                  {on && <IconCheck size={12} />}
                </span>
                <span className="bnt-recommend-label">{entry.label}</span>
                <span className="bnt-recommend-value">
                  {entry.changed && (
                    <>
                      <s>
                        {entry.color && <ColorDot value={entry.color.current} />}
                        <span className="bnt-recommend-current" title={entry.current}>{entry.current}</span>
                      </s>
                      <span aria-hidden>→</span>
                    </>
                  )}
                  <b>
                    {entry.color && <ColorDot value={entry.color.next} />}
                    {entry.background && (
                      <span className="bnt-recommend-background" style={{ background: entry.background }} aria-hidden />
                    )}
                    {entry.next}
                  </b>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="bnt-recommend-foot">{t.display.recommendSelected(picked.size)}</p>
    </>
  )
}

export function ThemeDisplayTab() {
  const { settings, askConfirm, showToast } = useApp()
  const t = useMessages()
  const accentColors = useAccentPalette()
  const paletteError = (error: unknown) => showToast(t.settings.saveFailed(error instanceof Error ? error.message : String(error)))
  const removeColor = async (color: string) => {
    try {
      const index = accentColors.indexOf(color)
      const remaining = await removeAccentColor(color)
      // 删除正在使用的颜色时选中相邻项；色板清空时保留当前页面颜色，仍可重新添加。
      updateSettings((prev) => prev.theme.accent.toLowerCase() === color && remaining.length
        ? { ...prev, theme: { ...prev.theme, accent: remaining[Math.min(index, remaining.length - 1)] } }
        : prev)
    } catch (error) {
      paletteError(error)
    }
  }
  const theme = getTheme(settings.theme.id)
  const tintSupported = supportsFrameworkSetting(theme, 'tintCards')

  /**
   * 把某套主题的推荐配置摊成清单问一句 —— 换主题之后和手动点「套用」走的是同一个弹窗，
   * 区别只在标题。勾选状态归清单自己管，这里的盒子只是留给确认回调读最终结果的出口。
   */
  const askRecommendation = (target: ThemeDefinition, title: string) => {
    const entries = recommendationEntries(target, settings, t)
    const selection: { current: ReadonlySet<string> } = {
      current: new Set(entries.filter((entry) => entry.changed).map((entry) => entry.key)),
    }
    askConfirm({
      title,
      message: <RecommendationList theme={target} entries={entries} selection={selection} />,
      confirmLabel: t.display.recommendApply,
      cancelLabel: t.display.recommendKeep,
      onConfirm: async () => {
        if (selection.current.has('accent')) await addAccentColor(target.recommends.accent)
        updateSettings((prev) => applyThemeRecommendation(target, prev, selection.current))
      },
    })
  }

  /*
   * 换主题只换主题本身，用户调好的圆角、卡片、显示项一概不动，换完再问要不要套推荐值。
   * 一项都不会变时不问：那一句话没有任何信息量 —— 手动点「套用」则总是把清单摆出来，
   * 那是用户自己要看这套配置。
   */
  const switchTheme = (id: string) => {
    const next = getTheme(id)
    updateSettings((prev) => ({ ...prev, theme: { ...prev.theme, id } }))
    const entries = recommendationEntries(next, settings, t)
    if (!entries.some((entry) => entry.changed)) return
    askRecommendation(next, t.display.recommendTitle(next.name(t)))
  }

  const resetCurrentThemeOptions = () => {
    const name = theme.name(t)
    askConfirm({
      title: t.display.resetThemeTitle(name),
      message: t.display.resetThemeMessage(name),
      confirmLabel: t.display.resetThemeConfirm,
      onConfirm: () => {
        updateSettings((prev) => ({
          ...prev,
          theme: {
            ...prev.theme,
            options: {
              ...prev.theme.options,
              [theme.id]: defaultThemeOptions(theme),
            },
          },
        }))
        showToast(t.display.resetThemeDone(name))
      },
    })
  }

  const values = themeOptionsOf(theme, settings.theme.options[theme.id])
  const setOption = (key: string, value: ThemeOptionValue) =>
    updateSettings((prev) => ({
      ...prev,
      theme: {
        ...prev.theme,
        options: {
          ...prev.theme.options,
          [theme.id]: {
            ...themeOptionsOf(theme, prev.theme.options[theme.id]),
            [key]: value,
          },
        },
      },
    }))

  return (
    <>
      <div className="bnt-group">
        <div className="bnt-group-title">{t.display.accent}</div>
        <div className="bnt-swatches">
          {accentColors.map((color) => (
            <span className="bnt-accent-item" key={color}>
              <button
                type="button"
                aria-label={color}
                aria-pressed={color === settings.theme.accent.toLowerCase()}
                className={`bnt-swatch${color === settings.theme.accent.toLowerCase() ? ' is-on' : ''}`}
                style={{ background: color, color }}
                onClick={() => updateSettings((prev) => ({ ...prev, theme: { ...prev.theme, accent: color } }))}
              />
              <button
                type="button"
                className="bnt-accent-remove"
                aria-label={t.display.removeAccent(color)}
                title={t.display.removeAccent(color)}
                onClick={() => void removeColor(color)}
              >
                <IconClose size={11} />
              </button>
            </span>
          ))}
          <ColorField
            variant="custom"
            label={t.display.customAccent}
            value={settings.theme.accent}
            onCommit={(accent) => { void addAccentColor(accent).catch(paletteError) }}
            onChange={(accent) =>
              updateSettings((prev) => ({ ...prev, theme: { ...prev.theme, accent } }))
            }
          />
        </div>
      </div>

      <div className="bnt-row">
        <span className="bnt-group-title">{t.display.scheme}</span>
        <span className="bnt-spacer" />
        <Segmented
          value={settings.theme.scheme}
          options={[
            { value: 'auto' as ColorScheme, label: t.display.schemeAuto },
            { value: 'light' as ColorScheme, label: t.display.schemeLight },
            { value: 'dark' as ColorScheme, label: t.display.schemeDark },
          ]}
          onChange={(scheme) =>
            updateSettings((prev) => ({ ...prev, theme: { ...prev.theme, scheme } }))
          }
        />
      </div>

      {/* 圆角和阴影跟主色、明暗一样是全局的：换主题不会把它们带走 */}
      <div className="bnt-group">
        <Slider
          label={t.display.radius}
          value={settings.theme.radius}
          min={0}
          max={28}
          step={1}
          display={`${settings.theme.radius} px`}
          onChange={(radius) =>
            updateSettings((prev) => ({ ...prev, theme: { ...prev.theme, radius } }))
          }
        />
        <Slider
          label={t.display.shadow}
          value={settings.theme.shadow}
          min={0}
          max={200}
          step={5}
          display={`${settings.theme.shadow}%`}
          onChange={(shadow) =>
            updateSettings((prev) => ({ ...prev, theme: { ...prev.theme, shadow } }))
          }
        />
      </div>

      {/* 染色是拿书签图标的主色去染卡片，配色的事，所以归在这一页 */}
      <div className="bnt-group bnt-display-switches">
        <FrameworkSetting setting="tintCards">
          <Switch
            on={settings.display.tintCards}
            label={t.display.tintCards}
            onChange={(tintCards) =>
              updateSettings((prev) => ({ ...prev, display: { ...prev.display, tintCards } }))
            }
          />
          {settings.display.tintCards && (
            <Slider
              label={t.display.tintStrength}
              value={settings.display.tintStrength}
              min={0}
              max={100}
              step={1}
              display={`${settings.display.tintStrength}%`}
              onChange={(tintStrength) =>
                updateSettings((prev) => ({ ...prev, display: { ...prev.display, tintStrength } }))
              }
            />
          )}
        </FrameworkSetting>
      </div>

      <div className="bnt-divider" />

      <div className="bnt-group">
        <div className="bnt-group-title">{t.display.theme}</div>
        <div className="bnt-theme-picker">
          <Segmented
            value={settings.theme.id}
            options={THEMES.map((item) => ({ value: item.id, label: item.name(t) }))}
            onChange={switchTheme}
          />
          <IconButton
            icon={<IconRestore size={17} />}
            title={t.display.resetThemeOptions(theme.name(t))}
            className="bnt-theme-reset"
            onClick={resetCurrentThemeOptions}
          />
        </div>
        <button
          type="button"
          className="bnt-inline-action"
          onClick={() => askRecommendation(theme, t.display.recommendApplyNow(theme.name(t)))}
        >
          {t.display.recommendApplyNow(theme.name(t))}
        </button>
      </div>

      <div className="bnt-divider" />

      <div className="bnt-group-title">{t.display.themeStyle(theme.name(t))}</div>
      <ThemeOptions theme={theme} values={values} onChange={setOption} />

      {/* 染色也在这一页，重置就得把它一起带上 */}
      <ResetDisplayTab
        onReset={async () => {
          await resetAccentPalette()
          updateSettings((prev) => ({
            ...prev,
            display: {
              ...prev.display,
              tintCards: tintSupported
                ? DEFAULT_SETTINGS.display.tintCards
                : prev.display.tintCards,
              tintStrength: tintSupported
                ? DEFAULT_SETTINGS.display.tintStrength
                : prev.display.tintStrength,
            },
            theme: structuredClone(DEFAULT_SETTINGS.theme),
          }))
        }}
      />
    </>
  )
}
