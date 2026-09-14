import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 拖动一条边来调节宽度。
 *
 * 拖动过程中的宽度只存在组件本地状态里，松手才写进设置 —— 否则每移动一像素都会
 * 触发一次带 debounce 的落盘，把 storage.sync 的写入频率配额打满。
 */
export function useResizable({
  value,
  min,
  max,
  onCommit,
  /** 把手在元素右边时往右拖变宽；在左边(如右侧栏)时相反 */
  invert = false,
}: {
  value: number
  min: number
  max: number
  onCommit: (next: number) => void
  invert?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const [live, setLive] = useState<number | null>(null)
  const start = useRef({ x: 0, width: 0 })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      start.current = { x: e.clientX, width: value }
      setLive(value)
      setDragging(true)
    },
    [value],
  )

  useEffect(() => {
    if (!dragging) return
    // 取整到 1px：半像素宽度既没意义，又会让设置里的数字看着很脏
    const clamp = (n: number) => Math.round(Math.min(max, Math.max(min, n)))
    const delta = (e: PointerEvent) =>
      (e.clientX - start.current.x) * (invert ? -1 : 1)
    const onMove = (e: PointerEvent) => {
      setLive(clamp(start.current.width + delta(e)))
    }
    const onUp = (e: PointerEvent) => {
      const next = clamp(start.current.width + delta(e))
      setDragging(false)
      setLive(null)
      onCommit(next)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    // 拖动时全局锁成左右箭头，并禁掉文本选中
    const prev = document.body.style.cursor
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = prev
      document.body.style.userSelect = ''
    }
  }, [dragging, min, max, onCommit, invert])

  return { width: live ?? value, dragging, onPointerDown }
}
