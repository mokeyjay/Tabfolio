import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { IconPalette } from './icons'

export function Switch({
  on,
  label,
  onChange,
}: {
  on: boolean
  label: ReactNode
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`bnt-switch${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="bnt-switch-label">{label}</span>
      <span className="bnt-switch-track">
        <span className="bnt-switch-knob" />
      </span>
    </button>
  )
}

export function NumberSetting({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  unit?: string
  min?: number
  max?: number
  step?: number
  onChange: (next: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => setDraft(String(value)), [value])

  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed))
    setDraft(String(next))
    onChange(next)
  }

  return (
    <label className="bnt-number-setting">
      <span className="bnt-label">{label}</span>
      <span className="bnt-input-group bnt-input-compact">
        <input
          type="number"
          inputMode="decimal"
          aria-label={label}
          value={draft}
          min={min}
          max={max}
          step={step}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        {unit && <span className="bnt-value">{unit}</span>}
      </span>
    </label>
  )
}

export interface SegOption<T extends string | number> {
  value: T
  label: ReactNode
}

/**
 * 分段控件的通用实现：tab 栏、目录展示方案、搜索范围……全都用它。
 *
 * 高亮块是一个独立的滑块层，按当前选中项的位置和宽度定位，所以切换时它是滑过去的，
 * 而不是在旧位置淡出、在新位置淡入。位置得在布局阶段量；字体加载完、容器变宽都会
 * 让宽度变，所以挂了 ResizeObserver 跟着修正。
 *
 * 滑块在量出位置之前干脆不渲染 —— 元素首次挂载不会触发过渡，这样就不需要额外的
 * 「先就位再启用动画」开关(用 rAF 做那件事在标签页不合成时会失效)。
 */
export function SlidingGroup<T extends string | number>({
  value,
  options,
  onChange,
  className,
  itemClassName,
  role = 'tablist',
  itemRole = 'tab',
  ariaLabel,
}: {
  value: T
  options: SegOption<T>[]
  onChange: (next: T) => void
  className: string
  itemClassName: string
  role?: string
  itemRole?: string
  ariaLabel?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const active = list.querySelector<HTMLElement>(`.${itemClassName}.is-on`)
      if (!active) return setRect(null)
      setRect({ left: active.offsetLeft, width: active.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [value, options, itemClassName])

  return (
    <div className={className} role={role} aria-label={ariaLabel} ref={listRef}>
      {rect && (
        <span
          className="bnt-slide-pill"
          aria-hidden
          style={{ transform: `translateX(${rect.left}px)`, width: rect.width }}
        />
      )}
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role={itemRole}
          aria-selected={itemRole === 'tab' ? o.value === value : undefined}
          aria-checked={itemRole === 'radio' ? o.value === value : undefined}
          className={`${itemClassName}${o.value === value ? ' is-on' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string | number>(props: {
  value: T
  options: SegOption<T>[]
  onChange: (next: T) => void
}) {
  return <SlidingGroup {...props} className="bnt-seg" itemClassName="bnt-seg-item" />
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (next: number) => void
}) {
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100
  return (
    <div className="bnt-group">
      <div className="bnt-row-baseline">
        <span className="bnt-label">{label}</span>
        <span className="bnt-spacer" />
        <span className="bnt-value">{display}</span>
      </div>
      <input
        className="bnt-range"
        style={{ '--fill': `${fill}%` } as CSSProperties}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="bnt-field">
      <span className="bnt-field-label">{label}</span>
      {children}
    </label>
  )
}

export function IconButton({
  icon,
  title,
  className = '',
  onClick,
}: {
  icon: ReactNode
  title: string
  className?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={`bnt-iconbtn ${className}`.trim()}
      onClick={onClick}
    >
      {icon}
    </button>
  )
}

/**
 * 颜色选择。
 *
 * 原生 `<input type="color">` 自带内边距和边框，做成圆形后总是歪一圈、还跟旁边的
 * 色点对不齐。这里把它铺满整个可点区域并透明化，外观完全由包裹的元素画：
 *   solid  —— 一个填着当前颜色的圆点，和预设色点长得一样
 *   custom —— 彩虹环 + 白色调色板图标；可用 onCommit 在完成取色时保存颜色
 */
export function ColorField({
  value,
  onChange,
  onCommit,
  variant = 'solid',
  active = false,
  label,
}: {
  value: string
  onChange: (next: string) => void
  onCommit?: (next: string) => void
  variant?: 'solid' | 'custom'
  active?: boolean
  label: string
}) {
  const isCustom = variant === 'custom'
  const inputRef = useRef<HTMLInputElement>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    // React 的 onChange 会随 input 连续触发；原生 change 才表示完成这次取色。
    const commit = () => commitRef.current?.(input.value)
    input.addEventListener('change', commit)
    return () => input.removeEventListener('change', commit)
  }, [])
  return (
    <span
      className={`bnt-colorfield${isCustom ? ' is-custom' : ''}${active ? ' is-on' : ''}`}
      style={{ background: isCustom && !active ? undefined : value, color: value }}
      title={label}
    >
      {isCustom && <IconPalette size={15} />}
      <input ref={inputRef} type="color" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </span>
  )
}
