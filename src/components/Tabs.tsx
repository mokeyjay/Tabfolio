import { SlidingGroup, type SegOption } from './ui'

/** 设置面板顶部的 tab 栏 —— 和其它分段控件共用同一套滑动高亮 */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: SegOption<T>[]
  onChange: (next: T) => void
}) {
  return (
    <SlidingGroup
      value={value}
      options={options}
      onChange={onChange}
      className="bnt-tabs"
      itemClassName="bnt-tab"
    />
  )
}
