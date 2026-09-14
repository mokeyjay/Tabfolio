import type { ThemeDefinition, ThemeOptionValue } from '../types'
import { Sidebar } from '../../components/Sidebar'
import { ContentArea } from '../../components/ContentArea'
import { RightPanel } from '../../components/RightPanel'
import { SidebarExpandHandles } from '../../components/SidebarExpandHandles'
import './glass.css'

/** 毛玻璃主题的页面骨架：左目录树 + 中书签区 + 右动态栏 */
function GlassLayout() {
  return (
    <div className="bnt-app">
      <Sidebar />
      <ContentArea />
      {/* 始终挂载：收起是滑出去而不是卸载，这样两个方向都有动画 */}
      <RightPanel />
      <SidebarExpandHandles />
    </div>
  )
}

export const glassTheme: ThemeDefinition = {
  id: 'glass',
  name: (t) => t.theme.glassName,
  description: (t) => t.theme.glassDescription,
  /*
   * 侧栏、书签卡片、子目录区块各有一组透明度 / 模糊度 —— 它们叠在壁纸上的层数不同，
   * 想要的通透感也不一样，共用一套参数调不出好效果。数值是「透明度」：越大越透。
   *
   * 默认值照着 macOS 侧栏的 vibrancy 配：半径大得多的背景模糊(系统那档在 50px 上下)、
   * 底色压到六成左右让壁纸的颜色透上来。卡片是要读字的，比侧栏实一档；子目录区块
   * 只是卡片的底，留得最透。
   */
  options: [
    { key: 'panelAlpha', label: (t) => t.theme.glassPanelAlpha, type: 'range', default: 38, min: 0, max: 100, step: 1, unit: '%' },
    { key: 'panelBlur', label: (t) => t.theme.glassPanelBlur, type: 'range', default: 50, min: 0, max: 120, step: 1, unit: 'px' },
    { key: 'cardAlpha', label: (t) => t.theme.glassCardAlpha, type: 'range', default: 30, min: 0, max: 100, step: 1, unit: '%' },
    { key: 'cardBlur', label: (t) => t.theme.glassCardBlur, type: 'range', default: 30, min: 0, max: 120, step: 1, unit: 'px' },
    { key: 'blockAlpha', label: (t) => t.theme.glassBlockAlpha, type: 'range', default: 80, min: 0, max: 100, step: 1, unit: '%' },
    { key: 'blockBlur', label: (t) => t.theme.glassBlockBlur, type: 'range', default: 20, min: 0, max: 120, step: 1, unit: 'px' },
  ],
  /*
   * 推荐值照 macOS 的比例来：16px 的面板圆角(控件落在 11px)、原汁原味的一档阴影、
   * 系统那支蓝。卡片染色一律不开 —— 毛玻璃已经把壁纸的颜色透上来了，再叠一层图标色只会脏。
   */
  recommends: {
    radius: 16,
    shadow: 100,
    accent: '#0071e3',
    layout: { cardWidth: 256, cardHeight: 64, maxContentWidth: 1280, contentTopPercent: 0 },
    display: { showDomain: true, showFolderPath: false, tintCards: false, tintStrength: 18 },
    folder: { mode: 'hidden', expandAll: false, rows: 2, child: null },
  },
  vars(options: Record<string, ThemeOptionValue>) {
    // 透明度 -> 不透明度，CSS 里直接当 alpha 用
    const solid = (v: unknown, fallback: number) =>
      String(1 - Number(v ?? fallback) / 100)
    const px = (v: unknown, fallback: number) => `${Number(v ?? fallback)}px`
    return {
      '--bnt-panel-a': solid(options.panelAlpha, 38),
      '--bnt-panel-blur': px(options.panelBlur, 50),
      '--bnt-card-a': solid(options.cardAlpha, 30),
      '--bnt-card-blur': px(options.cardBlur, 30),
      '--bnt-block-a': solid(options.blockAlpha, 80),
      '--bnt-block-blur': px(options.blockBlur, 20),
    }
  },
  Layout: GlassLayout,
}
