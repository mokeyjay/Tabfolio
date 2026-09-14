import { useLayoutEffect, useRef } from 'react'

const EASE = 'cubic-bezier(.22,.61,.36,1)'

/**
 * 内容变化时把高度差补成一段动画。
 *
 * 展开一个目录、折叠目录树，内容高度都是不确定的 auto,CSS transition 动不了。
 * 这里在布局阶段量出前后高度，交给 Web Animations 补间。
 *
 * 注意每次 commit 都要重新量一次高度，而不能只在 `dep` 变化时量：目录区块的列数是
 * ResizeObserver 量出来的，首帧只有 1 列、随后才变成真实列数，内容高度跟着涨了一截。
 * 如果只在 dep 变化时记录，首次「展开全部」拿到的就是首帧那个过时的矮高度，动画会先
 * 塌回去再长出来 —— 也就是只有第一次展开会闪一下。
 */
export function useAutoHeight<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null)
  const previous = useRef<number | null>(null)
  const lastDep = useRef(dep)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    // scrollHeight 量的是内容高度，不受我们正在跑的 height 动画影响，可以放心每帧读
    const next = el.scrollHeight
    const from = previous.current
    const changed = lastDep.current !== dep
    lastDep.current = dep
    previous.current = next

    if (!changed || from === null || from === next) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    el.style.overflow = 'hidden'
    const anim = el.animate([{ height: `${from}px` }, { height: `${next}px` }], {
      duration: 220,
      easing: EASE,
    })
    anim.onfinish = () => {
      el.style.overflow = ''
    }
  })

  return ref
}
