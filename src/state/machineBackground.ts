import type { LocalWallpaper, Settings } from '../types'
import { localArea } from '../platform/storage'
import { SETTINGS_VERSION } from './settingsSchema'
import { pack, unpack } from './versioning'

/**
 * 背景设置里「只属于本机」的那一半。
 *
 * 能跨设备的只有说得清自己是什么的东西：CSS 渐变、网络图片地址、目录结构 ——
 * 换台设备照样能还原出同一张图。本地图片的二进制留在本机 storage.local,
 * 元数据同步出去只会让别的设备多一条打不开的记录；关联目录的句柄和索引同理，
 * 从来就没离开过本机。
 *
 * 所以这些连同它们的选中状态一起收在这里，永远只写 storage.local，不占同步配额。
 * 读设置时再和同步来的那一半合起来，上层拿到的仍是一个完整的 Settings。
 */

const KEY = 'backgroundLocal'

export interface MachineBackground {
  /** 本机添加的本地图片壁纸 */
  wallpapers: LocalWallpaper[]
  /** 本地图片和关联目录文件的选中状态 */
  selectedIds: string[]
  /** 目录 id -> 本机关联的磁盘目录标识 */
  linkedSourceIds: Record<string, string>
}

export const EMPTY_MACHINE_BACKGROUND: MachineBackground = {
  wallpapers: [],
  selectedIds: [],
  linkedSourceIds: {},
}

/** 关联目录里的文件没有独立记录，靠 id 前缀认 */
function isMachineWallId(id: string, localWallIds: Set<string>): boolean {
  return localWallIds.has(id) || id.startsWith('linked:')
}

/** 拆成「同步出去的」和「留在本机的」两份 */
export function splitSettings(settings: Settings): {
  shared: Settings
  machine: MachineBackground
} {
  const bg = settings.background
  const localWallpapers = bg.wallpapers.filter(
    (wall): wall is LocalWallpaper => wall.kind === 'local',
  )
  const localWallIds = new Set(localWallpapers.map((wall) => wall.id))
  const linkedSourceIds: Record<string, string> = {}
  for (const folder of bg.folders) {
    if (folder.linkedSourceId) linkedSourceIds[folder.id] = folder.linkedSourceId
  }

  return {
    shared: {
      ...settings,
      background: {
        ...bg,
        wallpapers: bg.wallpapers.filter((wall) => wall.kind !== 'local'),
        // 目录本身要同步，但「本机绑了哪个磁盘目录」不是别的设备该知道的事
        folders: bg.folders.map(({ linkedSourceId: _linked, ...rest }) => rest),
        selectedIds: bg.selectedIds.filter((id) => !isMachineWallId(id, localWallIds)),
      },
    },
    machine: {
      wallpapers: localWallpapers,
      selectedIds: bg.selectedIds.filter((id) => isMachineWallId(id, localWallIds)),
      linkedSourceIds,
    },
  }
}

/** 合回一个完整的 Settings 交给上层 */
export function mergeSettings(shared: Settings, machine: MachineBackground): Settings {
  const bg = shared.background
  return {
    ...shared,
    background: {
      ...bg,
      wallpapers: [...bg.wallpapers, ...machine.wallpapers],
      folders: bg.folders.map((folder) => {
        const linkedSourceId = machine.linkedSourceIds[folder.id]
        return linkedSourceId ? { ...folder, linkedSourceId } : folder
      }),
      selectedIds: [...new Set([...bg.selectedIds, ...machine.selectedIds])],
    },
  }
}

function parseMachineBackground(raw: unknown): MachineBackground | null {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray((raw as MachineBackground).wallpapers) ||
    !Array.isArray((raw as MachineBackground).selectedIds) ||
    typeof (raw as MachineBackground).linkedSourceIds !== 'object' ||
    !(raw as MachineBackground).linkedSourceIds
  ) {
    return null
  }
  const { wallpapers, selectedIds, linkedSourceIds } = raw as MachineBackground
  return { wallpapers, selectedIds, linkedSourceIds }
}

export interface StoredMachineBackground {
  value: MachineBackground
  /** 更新版本的扩展写的(比如装回了旧版)，写回会冲掉新数据 */
  newer: boolean
}

export async function readMachineBackground(): Promise<StoredMachineBackground> {
  const unpacked = unpack(await localArea.get(KEY), SETTINGS_VERSION)
  const empty = () => structuredClone(EMPTY_MACHINE_BACKGROUND)
  switch (unpacked.status) {
    case 'empty':
    case 'invalid':
      return { value: empty(), newer: false }
    case 'current':
      return {
        value: parseMachineBackground(unpacked.data) ?? empty(),
        newer: false,
      }
    case 'newer':
      return { value: parseMachineBackground(unpacked.data) ?? empty(), newer: true }
  }
}

export async function writeMachineBackground(value: MachineBackground): Promise<void> {
  await localArea.set(KEY, pack(SETTINGS_VERSION, value))
}
