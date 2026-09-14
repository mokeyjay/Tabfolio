import { useCallback, useEffect, useRef, useState } from 'react'

/** 退出动画的时长，和 CSS 里的 bnt-*-out 保持一致 */
const EXIT_MS = 150

/**
 * 弹层的关闭动作。
 *
 * 直接把弹层从 DOM 里摘掉就没有退出动画可言，所以这里先置一个 `closing` 标记让 CSS
 * 播完淡出，再真正卸载。顺带统一接管 Esc —— 每个弹层都自己写一遍监听既啰嗦又容易漏。
 *
 * 注意：用它的组件必须是「打开时才挂载」的。如果组件常驻、只是内部 return null,
 * 那么 `closing` 会留在上一次关闭时的 true，下次打开会直接播淡出、停在 opacity 0 ——
 * 一个看不见却仍然拦截点击的遮罩，表现就是弹窗一闪而过、整个页面点不动了。
 */
export function useDismiss(commit: () => void, options: { escape?: boolean } = {}) {
  const { escape = true } = options
  const [closing, setClosing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const commitRef = useRef(commit)
  commitRef.current = commit

  const dismiss = useCallback(() => {
    if (timer.current) return // 已经在关了，别排第二次
    setClosing(true)
    timer.current = setTimeout(() => {
      timer.current = undefined
      commitRef.current()
    }, EXIT_MS)
  }, [])

  useEffect(() => {
    if (!escape) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      dismiss()
    }
    // capture 阶段监听，保证最上层的弹层先吃掉这次 Esc
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [escape, dismiss])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { closing, dismiss }
}
