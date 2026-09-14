import { useEffect, useRef, useState } from 'react'
import { columnsFor } from '../utils/metrics'

/**
 * 测量容器宽度换算出当前的列数。
 *
 * 「展开」方案要按「行」截断内容，而行数只有知道列数才算得出来 —— 而列数由
 * CSS grid 的 auto-fill 决定，只能反过来量。嵌套的目录区块宽度更窄，所以每个
 * 区块各自测量，而不是共用一个全局值。
 */
export function useColumns(cardWidth: number, gap = 9) {
  const ref = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setCols(columnsFor(el.clientWidth, cardWidth, gap))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cardWidth, gap])

  return [ref, cols] as const
}
