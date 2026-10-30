import type { FolderDisplaySetting, Settings, Wallpaper } from '../types'
import { pack, unpack, type Versioned } from './versioning'
import { THEME_BACKGROUNDS } from '../themes/backgrounds'

/**
 * 设置的持久化结构版本。同步的那一半(`settings`)和本机的那一半(`backgroundLocal`)
 * 共用这一个版本号 —— 它们本来就是同一份 Settings 拆开存的。
 */
export const SETTINGS_VERSION = 1

/** 目录展示方案的递归深度上限，防止用户把 child 套到天上去 */
export const MAX_FOLDER_DEPTH = 5

/** 侧栏宽度的可调范围，单位 px，精确到 1px */
export const SIDEBAR_MIN = 190
export const SIDEBAR_MAX = 420

/** 主色预设 —— 和主题无关，所有主题共用 */
export const ACCENT_PRESETS = [
  '#0071e3',
  '#5856d6',
  '#34a2a2',
  '#e08c1f',
  '#d0455f',
  '#2f8a4c',
  '#12b886',
]

export const PRESET_WALLPAPERS: Wallpaper[] = [
  { id: 'mist', kind: 'preset', name: '蓝雾', parentId: null, order: 0, css: 'radial-gradient(120% 100% at 20% 10%,#dfeafc 0%,#c6dbf6 45%,#a9c8ef 100%)' },
  { id: 'dawn', kind: 'preset', name: '晨曦', parentId: null, order: 1, css: 'radial-gradient(120% 100% at 80% 0%,#ffe9d9 0%,#e4dcf5 48%,#c9d8f5 100%)' },
  { id: 'mint', kind: 'preset', name: '薄荷', parentId: null, order: 2, css: 'radial-gradient(120% 100% at 30% 90%,#d8f2ea 0%,#c2e4ef 50%,#aecdf0 100%)' },
  { id: 'dusk', kind: 'preset', name: '暮色', parentId: null, order: 3, css: 'radial-gradient(120% 100% at 70% 20%,#cfd8f2 0%,#b3bfe6 45%,#8f9fd6 100%)' },
  { id: 'sand', kind: 'preset', name: '沙丘', parentId: null, order: 4, css: 'radial-gradient(120% 100% at 20% 20%,#f6ecdd 0%,#e8dcc9 50%,#d5c8b6 100%)' },
  { id: 'ink', kind: 'preset', name: '墨蓝', parentId: null, order: 5, css: 'radial-gradient(120% 100% at 60% 10%,#bfd2ee 0%,#93aede 50%,#6b8ac9 100%)' },
  { id: 'paper', kind: 'preset', name: '素纸', parentId: null, order: 6, css: 'linear-gradient(180deg,#f7f8fa 0%,#eceef2 100%)' },
  ...Object.values(THEME_BACKGROUNDS),
]

export const DEFAULT_FOLDER_SETTING: FolderDisplaySetting = {
  mode: 'hidden',
  expandAll: false,
  rows: 2,
  child: null,
}

export const DEFAULT_SETTINGS: Settings = {
  layout: { maxContentWidth: 1280, cardWidth: 256, cardHeight: 64, contentTopPercent: 0 },
  folder: DEFAULT_FOLDER_SETTING,
  tabOpening: { confirmThreshold: 12 },
  display: { showDomain: true, showFolderPath: false, tintCards: false, tintStrength: 18 },
  sidebar: { leftOpen: true, rightOpen: false, width: 252, rightWidth: 282 },
  search: { scope: 'all' },
  selection: { lastFolderPath: null, pinnedFolderPath: null },
  background: {
    bingEnabled: false,
    wallpapers: PRESET_WALLPAPERS,
    folders: [],
    selectedIds: ['mist'],
    selectedFolderIds: [],
    fit: 'cover',
    rotate: 'off',
    intervalMinutes: 30,
    blur: 0,
    dim: 0,
  },
  theme: {
    id: 'glass',
    accent: '#0071e3',
    scheme: 'auto',
    // 圆角和阴影的默认值 = 默认主题(毛玻璃)的推荐值，见 themes/glass/index.tsx
    radius: 16,
    shadow: 100,
    options: {
      // 与各主题 options 里的 default 保持一致，改一处就得改另一处
      glass: {
        panelAlpha: 38,
        panelBlur: 50,
        cardAlpha: 30,
        cardBlur: 30,
        blockAlpha: 80,
        blockBlur: 20,
      },
      acrylic: { opacity: 80, blur: 30, saturation: 150, noise: 2 },
      paper: { tone: 'warm', wash: 100 },
    },
  },
  customCss: '',
  language: 'auto',
  syncEnabled: true,
}

type Plain = Record<string, unknown>
const isPlain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const SETTINGS_KEYS = [
  'layout',
  'folder',
  'tabOpening',
  'display',
  'sidebar',
  'search',
  'selection',
  'background',
  'theme',
  'customCss',
  'language',
  'syncEnabled',
] as const

/**
 * 校验当前版本的设置结构。字段不全或类型不对时返回 null。
 *
 * 不认识的顶层字段直接丢掉而不是判为无效 —— 读到更新版本写下的设置时，
 * 多出来的字段不该让整份设置作废。
 */
export function parseSettings(raw: unknown): Settings | null {
  if (
    !isPlain(raw) ||
    SETTINGS_KEYS.some((key) => !(key in raw)) ||
    !isPlain(raw.layout) ||
    typeof raw.layout.contentTopPercent !== 'number' ||
    !isPlain(raw.sidebar) ||
    typeof raw.sidebar.leftOpen !== 'boolean' ||
    !isPlain(raw.background) ||
    typeof raw.background.bingEnabled !== 'boolean' ||
    !Array.isArray(raw.background.wallpapers) ||
    !Array.isArray(raw.background.folders) ||
    !Array.isArray(raw.background.selectedIds) ||
    !Array.isArray(raw.background.selectedFolderIds) ||
    !isPlain(raw.theme) ||
    typeof raw.theme.radius !== 'number' ||
    typeof raw.theme.shadow !== 'number' ||
    !isPlain(raw.theme.options)
  ) {
    return null
  }
  const picked: Plain = {}
  for (const key of SETTINGS_KEYS) picked[key] = raw[key]
  return picked as unknown as Settings
}

export interface StoredSettings {
  settings: Settings
  /**
   * 存储里是更新版本的扩展写的。能解析出来就先照着显示，但在本扩展更新之前
   * 不能写回 —— 旧结构会把新版本的数据冲掉。
   */
  newer: boolean
}

/** 从存储里的原始值还原同步那一半设置；没有或无效时回落到默认设置。 */
export function readStoredSettings(raw: unknown): StoredSettings {
  const unpacked = unpack(raw, SETTINGS_VERSION)
  const fallback = () => structuredClone(DEFAULT_SETTINGS)
  switch (unpacked.status) {
    case 'empty':
    case 'invalid':
      return { settings: fallback(), newer: false }
    case 'current':
      return {
        settings: parseSettings(unpacked.data) ?? fallback(),
        newer: false,
      }
    case 'newer':
      return { settings: parseSettings(unpacked.data) ?? fallback(), newer: true }
  }
}

export function packSettings(settings: Settings): Versioned<Settings> {
  return pack(SETTINGS_VERSION, settings)
}

export function clampFolderSetting(
  s: FolderDisplaySetting,
  depth = 0,
): FolderDisplaySetting {
  return {
    mode: s.mode,
    expandAll: !!s.expandAll,
    rows: Math.max(1, Math.round(s.rows || 2)),
    child: depth + 1 >= MAX_FOLDER_DEPTH || !s.child
      ? null
      : clampFolderSetting(s.child, depth + 1),
  }
}
