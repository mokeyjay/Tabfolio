/** 归一化后的书签节点。url 为空即目录。 */
export interface BookmarkNode {
  /** 浏览器本地 id。注意：同一书签在不同设备上 id 不同，不可用于持久化。 */
  id: string
  parentId?: string
  index: number
  title: string
  url?: string
  dateAdded?: number
  children?: BookmarkNode[]
  /** 带类型与同级序号的唯一定位路径，供选择和拖拽判断使用。 */
  path: string
  /** 给用户显示和搜索的普通路径，如 `/书签栏/工作/设计`。 */
  displayPath: string
  /** 附加数据 Key；包含父目录定位和同级重复项序号。 */
  key: string
  /** 该节点及其子孙下的书签总数(目录才有意义) */
  count: number
  depth: number
}

/**
 * 目录在书签区域里的展示方案。
 *
 * `hidden` 是默认值：书签区只放书签，目录另有导航。其余三种是让目录也进入书签区的
 * 不同方式 —— `default` 当作列表里的普通一项，`pinned` 挑出来放在最顶端，
 * `expanded` 就地展开成一个区块。
 */
export type FolderMode = 'hidden' | 'default' | 'pinned' | 'expanded'

/**
 * 目录展示方案。可递归 —— `child` 描述"这个目录内部的子目录"该怎么展示，
 * 因此可以做到「在展开的目录里继续展开子目录」。
 */
export interface FolderDisplaySetting {
  mode: FolderMode
  /** mode=expanded 时：忽略 rows 限制，展开全部内容 */
  expandAll: boolean
  /** mode=expanded 时：默认露出的书签行数 */
  rows: number
  /** 子目录的展示方案。null 表示子目录按「默认」处理，不再递归。 */
  child: FolderDisplaySetting | null
}

export type WallpaperKind = 'preset' | 'url' | 'local'

export interface WallpaperBase {
  id: string
  name: string
  kind: WallpaperKind
  /** 所属的虚拟背景目录；null 表示背景根目录。 */
  parentId: string | null
  /** 与同目录下的背景和子目录共享的排序值。 */
  order: number
}
/** 内置渐变，零存储成本 */
export interface PresetWallpaper extends WallpaperBase {
  kind: 'preset'
  css: string
}
/** 在线图片：只存 URL，能真正跨设备同步 */
export interface UrlWallpaper extends WallpaperBase {
  kind: 'url'
  url: string
}
/**
 * 本地文件：整条记录都不出本机 —— 二进制在 storage.local，元数据在
 * `backgroundLocal`。同步出去别的设备也只能得到一条打不开的记录。
 */
export interface LocalWallpaper extends WallpaperBase {
  kind: 'local'
  mime: string
  /** 添加它的设备标识，留作来源记录 */
  deviceId: string
}
export type Wallpaper = PresetWallpaper | UrlWallpaper | LocalWallpaper

/** 背景页里的虚拟目录。本地目录关联只记录标识，真实句柄与索引始终留在本机。 */
export interface BackgroundFolder {
  id: string
  name: string
  parentId: string | null
  order: number
  /** 非空表示这个空虚拟目录已经关联同 id 的本地目录数据。 */
  linkedSourceId?: string
}

/** 本地目录索引生成的运行时壁纸，不会写进同步设置。 */
export interface LinkedWallpaper {
  id: string
  name: string
  kind: 'linked'
  sourceId: string
  path: string
  mime: string
  size: number
  lastModified: number
  /** 扩展内的逻辑目录；移动它不会修改磁盘文件位置。 */
  parentId: string | null
  order: number
}

/** Bing 首页提供的动态壁纸，只存在于运行时缓存，不写入可同步壁纸列表。 */
export interface BingWallpaper {
  id: string
  name: string
  kind: 'bing'
  url: string
  date: string
  copyright: string
  copyrightLink: string
}

export type RuntimeWallpaper = Wallpaper | LinkedWallpaper | BingWallpaper

export type RotateMode = 'off' | 'sequential' | 'random'

/** 背景图的填充方式 */
export type BackgroundFit = 'cover' | 'contain' | 'stretch' | 'tile'

/** 自定义图标。与背景图同样的分治策略。 */
export type CustomIcon =
  | { kind: 'url'; url: string }
  | { kind: 'local'; id: string; mime: string; deviceId: string }

/** 扩展自有的书签附加数据 —— 浏览器书签协议不支持这些字段。 */
export interface BookmarkMeta {
  icon?: CustomIcon
}

/** 搜索范围：只搜当前目录，还是搜全部书签 */
export type SearchScope = 'folder' | 'all'

export type ColorScheme = 'auto' | 'light' | 'dark'

/** 界面语言；auto 表示跟着浏览器语言走 */
export type Language = 'auto' | 'en' | 'zh'

export interface Settings {
  layout: {
    /** 0 = 满宽 */
    maxContentWidth: number
    cardWidth: number
    cardHeight: number
    /** 内容区距视口顶部的高度百分比，0-100。 */
    contentTopPercent: number
  }
  folder: FolderDisplaySetting
  tabOpening: {
    /** 目录批量打开超过此数量时要求二次确认；0 表示每次都确认。 */
    confirmThreshold: number
  }
  display: {
    showDomain: boolean
    /** 在内容区标题上显示当前目录的完整路径 */
    showFolderPath: boolean
    /** 取书签图标的主色，叠在卡片背景上 */
    tintCards: boolean
    /** 上面那层颜色的浓度，0-100 */
    tintStrength: number
  }
  sidebar: {
    leftOpen: boolean
    rightOpen: boolean
    /** 左栏宽度，可拖拽调节 */
    width: number
    /** 右栏宽度，可拖拽调节 */
    rightWidth: number
  }
  search: {
    scope: SearchScope
  }
  selection: {
    /** 上次选中的目录路径，下次打开默认选中 */
    lastFolderPath: string | null
    /** 「钉住」的目录路径。非空时永远优先于 lastFolderPath。 */
    pinnedFolderPath: string | null
  }
  background: {
    /** 开启后优先显示 Bing 每日壁纸；此开关随设置同步。 */
    bingEnabled: boolean
    wallpapers: Wallpaper[]
    folders: BackgroundFolder[]
    /** 直接参与显示或轮换的单张背景。 */
    selectedIds: string[]
    /** 参与显示或轮换的目录；会递归包含其全部子目录。 */
    selectedFolderIds: string[]
    fit: BackgroundFit
    rotate: RotateMode
    intervalMinutes: number
    blur: number
    /** 压暗程度 0-100，保证卡片文字在亮色壁纸上仍可读 */
    dim: number
  }
  theme: {
    id: string
    /** 主色、明暗、圆角、阴影是所有主题共用的 —— 换主题不该把它们丢掉 */
    accent: string
    scheme: ColorScheme
    /** 面板圆角，px。控件和卡片的圆角都按它等比推出来 */
    radius: number
    /** 阴影浓度，百分比。0 = 完全平面，100 = 各主题的原始配方 */
    shadow: number
    /** 各主题自己的样式配置项，按主题 id 分开存 */
    options: Record<string, Record<string, string | number | boolean>>
  }
  customCss: string
  /** 界面语言 */
  language: Language
  /** 关闭后设置只留在本机 storage.local */
  syncEnabled: boolean
}

export interface VisitStat {
  count: number
  last: number
}
