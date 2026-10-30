import type { PresetWallpaper } from '../types'

/** 主题推荐背景也作为内置壁纸提供，可在背景页单独选择。 */
function background(theme: string, name: string, order: number, css: string): PresetWallpaper {
  return { id: `theme-${theme}`, kind: 'preset', name, parentId: null, order, css }
}

export const THEME_BACKGROUNDS = {
  glass: background('glass', '流光蓝', 7,
    'radial-gradient(ellipse at 15% 15%,#edf5ff 0%,transparent 55%),radial-gradient(ellipse at 85% 80%,#c4b8ea 0%,transparent 60%),linear-gradient(135deg,#bfd8f5,#a9c9eb)'),
  acrylic: background('acrylic', '极光', 8,
    'radial-gradient(ellipse at 80% 15%,#c9bcf4 0%,transparent 55%),radial-gradient(ellipse at 15% 85%,#9fdedc 0%,transparent 60%),linear-gradient(145deg,#c4d7f3,#89aede)'),
  paper: background('paper', '暖纸', 9,
    'radial-gradient(ellipse at 30% 0%,#fffaf0 0%,transparent 70%),linear-gradient(150deg,#f2ecdf,#e2d7c5)'),
  whitespace: background('whitespace', '晨白', 10,
    'radial-gradient(ellipse at 50% 0%,#fffefa 0%,transparent 75%),linear-gradient(180deg,#f5f2ec,#eae6de)'),
  columns: background('columns', '雾灰蓝', 11,
    'radial-gradient(ellipse at 10% 0%,#eaf0f8 0%,transparent 65%),linear-gradient(135deg,#dce4ef,#bccbdb)'),
  columnar: background('columnar', '银灰', 12,
    'radial-gradient(ellipse at 80% 10%,#fafaf8 0%,transparent 65%),linear-gradient(135deg,#e8e9e7,#cdd2d4)'),
} satisfies Record<string, PresetWallpaper>
