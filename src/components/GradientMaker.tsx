import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Wallpaper } from '../types'
import {
  DEFAULT_SPEC,
  buildGradient,
  randomSpec,
  type GradientSpec,
  type GradientType,
} from '../utils/gradient'
import { newImageId } from '../platform/blobs'
import { useDismiss } from '../hooks/useDismiss'
import { useModalA11y } from '../hooks/useModalA11y'
import { ColorField, Segmented, Slider } from './ui'
import { IconAdd, IconClose, IconReset } from './icons'
import { messages, useMessages, type Messages } from '../i18n'

function typeOptions(t: Messages): { value: GradientType; label: string }[] {
  return [
    { value: 'radial', label: t.gradient.radial },
    { value: 'linear', label: t.gradient.linear },
  ]
}

/**
 * 自己造一张渐变壁纸。
 *
 * 内置的那几张就是这么来的 —— 一串 CSS 渐变字符串，不占存储、能跨设备同步、
 * 任意分辨率都不糊。所以这里除了给参数，也直接把生成出来的 CSS 摆出来：
 * 调参数会写进输入框，反过来往输入框里粘一段自己的 CSS 也照单全收。
 */
export function GradientMaker({
  onAdd,
  onClose,
}: {
  onAdd: (wall: Wallpaper) => void
  onClose: () => void
}) {
  const t = useMessages()
  const [spec, setSpec] = useState<GradientSpec>(DEFAULT_SPEC)
  const [css, setCss] = useState(() => buildGradient(DEFAULT_SPEC))
  const [name, setName] = useState(() => messages().gradient.defaultName)
  const { closing, dismiss } = useDismiss(onClose)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y(overlayRef, dialogRef)

  // 动参数就重新生成 CSS；用户自己改输入框时不反推参数，直接用他写的
  const applySpec = (next: GradientSpec) => {
    setSpec(next)
    setCss(buildGradient(next))
  }
  const patch = (p: Partial<GradientSpec>) => applySpec({ ...spec, ...p })

  const setColor = (i: number, value: string) => {
    const colors = [...spec.colors] as GradientSpec['colors']
    colors[i] = value
    patch({ colors })
  }

  /*
   * 必须 portal 到 body：这个弹窗是从设置面板内部渲染的，而设置面板带 backdrop-filter,
   * 那个属性会让后代的 position: fixed 以它为包含块 —— 弹窗会被困在设置面板的盒子里，
   * 而且自己的毛玻璃只能采样到设置面板，整个糊成一片。
   */
  return createPortal(
    <div
      ref={overlayRef}
      className={`bnt-overlay bnt-overlay-scrim${closing ? ' is-closing' : ''}`}
      style={{ zIndex: 75 }}
      onMouseDown={dismiss}
    >
      <div
        ref={dialogRef}
        className="bnt-dialog bnt-dialog-sm bnt-glass"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-label={t.gradient.title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bnt-dialog-head">
          <div className="bnt-dialog-title">{t.gradient.title}</div>
          <span className="bnt-spacer" />
          <button type="button" className="bnt-iconbtn" aria-label={t.common.close} onClick={dismiss}>
            <IconClose size={15} />
          </button>
        </div>

        <div className="bnt-gradient-preview" style={{ background: css } as never} />

        <div className="bnt-row">
          <span className="bnt-label">{t.gradient.type}</span>
          <span className="bnt-spacer" />
          <Segmented value={spec.type} options={typeOptions(t)} onChange={(type) => patch({ type })} />
        </div>

        <div className="bnt-row">
          <span className="bnt-label">{t.gradient.stops}</span>
          <span className="bnt-spacer" />
          <div className="bnt-swatches">
            {spec.colors.map((c, i) => (
              <ColorField
                key={i}
                label={t.gradient.stop(i + 1)}
                value={c}
                onChange={(v) => setColor(i, v)}
              />
            ))}
          </div>
        </div>

        {spec.type === 'linear' ? (
          <Slider
            label={t.gradient.angle}
            value={spec.angle}
            min={0}
            max={360}
            step={1}
            display={`${spec.angle}°`}
            onChange={(angle) => patch({ angle })}
          />
        ) : (
          <div className="bnt-grid-2">
            <Slider
              label={t.gradient.centerX}
              value={spec.x}
              min={0}
              max={100}
              step={1}
              display={`${spec.x}%`}
              onChange={(x) => patch({ x })}
            />
            <Slider
              label={t.gradient.centerY}
              value={spec.y}
              min={0}
              max={100}
              step={1}
              display={`${spec.y}%`}
              onChange={(y) => patch({ y })}
            />
          </div>
        )}

        <div className="bnt-field">
          <span className="bnt-field-label">{t.gradient.name}</span>
          <input
            className="bnt-input"
            value={name}
            placeholder={t.gradient.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="bnt-field">
          <span className="bnt-field-label">CSS</span>
          <textarea
            className="bnt-textarea"
            style={{ minHeight: 74 }}
            spellCheck={false}
            value={css}
            onChange={(e) => setCss(e.target.value)}
          />
        </div>

        <div className="bnt-divider" />
        <div className="bnt-dialog-foot">
          <button
            type="button"
            className="bnt-btn-ghost"
            onClick={() => applySpec(randomSpec())}
          >
            <IconReset size={14} />
            {t.gradient.random}
          </button>
          <span className="bnt-spacer" />
          <button type="button" className="bnt-btn-ghost" onClick={dismiss}>
            {t.gradient.cancel}
          </button>
          <button
            type="button"
            className="bnt-btn bnt-btn-primary bnt-btn-lg"
            disabled={!css.trim()}
            onClick={() => {
              onAdd({
                id: newImageId(),
                kind: 'preset',
                name: name.trim() || t.gradient.defaultName,
                parentId: null,
                order: 0,
                css: css.trim(),
              })
              dismiss()
            }}
          >
            <IconAdd size={15} />
            {t.gradient.add}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
