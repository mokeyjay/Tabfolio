import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

export interface WindowPosition { x: number; y: number }

/** 保留安全边距；窄屏时也保证标题栏和关闭按钮可触达。 */
export function clampWindowPosition(position: WindowPosition, width: number, height: number, viewportWidth: number, viewportHeight: number): WindowPosition {
  const gap = 16
  return {
    x: Math.round(Math.max(gap, Math.min(position.x, viewportWidth - width - gap))),
    y: Math.round(Math.max(gap, Math.min(position.y, viewportHeight - height - gap))),
  }
}

/** 使用指针捕获拖动，离开标题栏后仍能继续移动；只更新本机临时位置。 */
export function useDraggableWindow(ref: RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState<WindowPosition>({ x: 16, y: 16 })
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ pointerId: number; x: number; y: number; position: WindowPosition } | null>(null)

  const clamp = (next: WindowPosition) => {
    const el = ref.current
    return el ? clampWindowPosition(next, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight) : next
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const keepInView = () => setPosition((current) => clampWindowPosition(
      current, el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight,
    ))
    // 打开时沿用原设置弹窗的居中位置，之后由用户自由拖动。
    setPosition(clampWindowPosition(
      { x: (window.innerWidth - el.offsetWidth) / 2, y: (window.innerHeight - el.offsetHeight) / 2 },
      el.offsetWidth, el.offsetHeight, window.innerWidth, window.innerHeight,
    ))
    const observer = new ResizeObserver(keepInView)
    observer.observe(el)
    window.addEventListener('resize', keepInView)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', keepInView)
    }
  }, [ref])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position }
    setDragging(true)
  }
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = start.current
    if (!origin || origin.pointerId !== event.pointerId) return
    setPosition(clamp({
      x: origin.position.x + event.clientX - origin.x,
      y: origin.position.y + event.clientY - origin.y,
    }))
  }
  const stop = () => {
    start.current = null
    setDragging(false)
  }
  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (start.current?.pointerId !== event.pointerId) return
    onPointerMove(event)
    stop()
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 80 : 20
    const delta: Record<string, WindowPosition> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    }
    if (!delta[event.key]) return
    event.preventDefault()
    setPosition((current) => clamp({ x: current.x + delta[event.key].x, y: current.y + delta[event.key].y }))
  }

  return {
    position, dragging,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: stop, onLostPointerCapture: stop, onKeyDown },
  }
}
