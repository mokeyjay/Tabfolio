import type { BackgroundFolder, RuntimeWallpaper, Settings } from '../types'
import { loadLocalImage } from '../hooks/useLocalImage'
import { directoryFilesInFolder, loadLinkedImage } from './directoryStore'

/**
 * 背景图轮换的进度。
 *
 * 存在 localStorage 而不是只挂一个 setInterval —— 新标签页通常开几秒就关了，
 * 纯计时器的话背景永远轮不到第二张。按「距上次切换过了多久」推进，无论页面开着
 * 还是反复新开都符合预期。
 */
const STATE_KEY = 'bnt.bgRotation'

export interface RotationState {
  index: number
  since: number
}

export function readRotation(): RotationState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) return JSON.parse(raw) as RotationState
  } catch {
    /* 落到默认值 */
  }
  return { index: 0, since: Date.now() }
}

export function writeRotation(state: RotationState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state))
}

/**
 * 按背景目录树的顺序展开当前轮换目录。
 *
 * 这里故意不做任何回退：所有已选壁纸或目录都不可用时返回空数组，渲染层因此
 * 只留下主题的纯色底，而不是擅自换成别的背景。
 */
export function rotationWallpapers(settings: Settings): RuntimeWallpaper[] {
  const { wallpapers, folders, selectedIds, selectedFolderIds } = settings.background
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]))
  const selectedWalls = new Set(selectedIds)
  const selectedFolders = new Set(selectedFolderIds)

  const childrenOf = (parentId: string | null) => [
    ...wallpapers.filter((wall) => wall.parentId === parentId),
    ...folders.filter((folder) => folder.parentId === parentId),
    ...directoryFilesInFolder(parentId),
  ].sort((a, b) => a.order - b.order)

  const out: RuntimeWallpaper[] = []
  const added = new Set<string>()
  const visiting = new Set<string>()
  const add = (wall: RuntimeWallpaper) => {
    if (added.has(wall.id)) return
    added.add(wall.id)
    out.push(wall)
  }
  const visit = (parentId: string | null, inheritedSelection: boolean) => {
    const folder = parentId === null ? undefined : folderMap.get(parentId)
    const folderSelected = inheritedSelection || (!!folder && selectedFolders.has(folder.id))
    for (const item of childrenOf(parentId)) {
      if ('kind' in item) {
        if (folderSelected || selectedWalls.has(item.id)) add(item)
        continue
      }
      const child = item as BackgroundFolder
      // 损坏的循环关系不该拖死新标签页。
      if (visiting.has(child.id)) continue
      visiting.add(child.id)
      visit(child.id, folderSelected)
      visiting.delete(child.id)
    }
  }
  visit(null, false)
  return out
}

/**
 * 一轮的时长。0 是有意义的取值 —— 「每次打开新标签页都换一张」：启动时算出来的
 * 「距上次切换已过 0 毫秒」永远够一轮，于是每次开页都推进。页面开着期间的计时器
 * 见 Background，那边遇到 0 会直接不排，不然就是每 0 毫秒闪一张。
 */
export function periodMs(settings: Settings): number {
  return Math.max(0, settings.background.intervalMinutes) * 60_000
}

export function nextIndex(current: number, total: number, random: boolean): number {
  if (total < 2) return 0
  return random ? Math.floor(Math.random() * total) : (current + 1) % total
}

/**
 * 此刻应该显示哪一张。到点了就推进并写回进度。
 *
 * 只在启动时调用一次(boot)，页面开着期间的后续切换由 Background 的计时器负责 ——
 * 两边都推进的话会一次跳两张。
 */
export function resolveActiveWallpaper(settings: Settings): RuntimeWallpaper | undefined {
  const list = rotationWallpapers(settings)
  if (!list.length) return undefined

  const { rotate } = settings.background
  const state = readRotation()
  let index = state.index

  if (rotate !== 'off' && list.length > 1 && Date.now() - state.since >= periodMs(settings)) {
    index = nextIndex(index, list.length, rotate === 'random')
    writeRotation({ index, since: Date.now() })
  }

  return list[index % list.length]
}

/**
 * 首屏之前把背景图读进内存。
 *
 * 本地图片存在 chrome.storage.local 里，读取是异步的；不预读的话第一帧画的是纯底色，
 * 图片晚一拍才盖上来 —— 就是打开新标签页时看到的那一下闪。
 */
export async function preloadActiveWallpaper(settings: Settings): Promise<void> {
  const wall = resolveActiveWallpaper(settings)
  try {
    if (wall?.kind === 'local') await loadLocalImage(wall.id)
    if (wall?.kind === 'linked') await loadLinkedImage(wall)
  } catch {
    // 读不到就按「本机没有这张图」处理，不该拦住启动
  }
}
