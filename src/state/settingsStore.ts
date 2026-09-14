import type { Settings } from '../types'
import { createStore, debounce, useStore } from './store'
import { currentArea, isSyncEnabled, onAreaChange, switchArea } from './area'
import { DEFAULT_SETTINGS, packSettings, readStoredSettings } from './settingsSchema'
import { setSyncEnabledForMeta } from './metaStore'
import { messages } from '../i18n'
import { removeImage } from '../platform/blobs'
import { unlinkDirectory } from './directoryStore'
import {
  EMPTY_MACHINE_BACKGROUND,
  mergeSettings,
  readMachineBackground,
  splitSettings,
  writeMachineBackground,
  type MachineBackground,
} from './machineBackground'

interface SettingsState {
  ready: boolean
  settings: Settings
  /** 写入失败信息(sync 超配额、超写入频率)，在设置面板里提示用户 */
  error: string | null
  /** 存储里的设置由更新版本的扩展写入，本机暂停落盘，等扩展更新后恢复 */
  newerVersion: boolean
}

const store = createStore<SettingsState>({
  ready: false,
  settings: DEFAULT_SETTINGS,
  error: null,
  newerVersion: false,
})

/**
 * 同步那一半 / 本机那一半是不是更新版本写的。任一为真就拒绝落盘：
 * 用旧结构写回去，新版本加的字段和改过的结构就全没了。
 */
let sharedNewer = false
let machineNewer = false

/** 存储里是更新版本写的设置，拒绝用当前版本的结构覆盖 */
export class NewerSettingsError extends Error {
  constructor() {
    super(messages().settings.newerVersion)
    this.name = 'NewerSettingsError'
  }
}

/** 暂停落盘已经由 newerVersion 常驻提示，不必再叠一条「保存失败」 */
function failureMessage(error: unknown, format: (message: string) => string): string | null {
  if (error instanceof NewerSettingsError) return null
  return format(error instanceof Error ? error.message : String(error))
}

let unwatch: () => void = () => {}
/** 自己刚写下去的快照，用来区分「远端来的变更」和「自己写入的回声」 */
let lastWritten = ''
/**
 * 本机那一半背景数据的当前值。远端只会带来共享的那一半，合成完整设置时得就着
 * 这份快照拼 —— 它跟着每次写入更新，不必回头去读存储。
 */
let machine: MachineBackground = structuredClone(EMPTY_MACHINE_BACKGROUND)

function apply(settings: Settings, error: string | null = store.get().error) {
  store.set({ ready: true, settings, error, newerVersion: sharedNewer || machineNewer })
}

/** 落盘：共享的那一半按当前存储区走，本机那一半永远留在 local */
function write(settings: Settings): Promise<unknown> {
  if (sharedNewer || machineNewer) return Promise.reject(new NewerSettingsError())
  const split = splitSettings(settings)
  machine = split.machine
  lastWritten = JSON.stringify(split.shared)
  return Promise.all([
    currentArea().set('settings', packSettings(split.shared)),
    writeMachineBackground(split.machine),
  ])
}

function watchRemote() {
  unwatch()
  const area = currentArea()
  unwatch = area.subscribe('settings', async () => {
    const stored = readStoredSettings(await area.get('settings'))
    const shared = stored.settings
    shared.syncEnabled = isSyncEnabled()
    const newerChanged = stored.newer !== sharedNewer
    sharedNewer = stored.newer
    const snapshot = JSON.stringify(shared)
    if (snapshot === lastWritten && !newerChanged) return // 自己写的回声，忽略
    lastWritten = snapshot
    const settings = mergeSettings(shared, machine)
    apply(settings)
    // 旧版本设备刚写了一份旧结构，升级后写回，那台设备随之进入只读
    if (stored.migrated) persist(settings)
  })
}

const persist = debounce((settings: Settings) => {
  write(settings).then(
    () => {
      if (store.get().error) apply(store.get().settings, null)
    },
    (err: unknown) => {
      apply(store.get().settings, failureMessage(err, messages().settings.saveFailed))
    },
  )
}, 400)

export async function loadSettings(): Promise<void> {
  const [raw, storedMachine] = await Promise.all([
    currentArea().get('settings'),
    readMachineBackground(),
  ])
  const stored = readStoredSettings(raw)
  const shared = stored.settings
  shared.syncEnabled = isSyncEnabled()
  sharedNewer = stored.newer
  machineNewer = storedMachine.newer
  machine = storedMachine.value
  lastWritten = JSON.stringify(shared)
  const settings = mergeSettings(shared, machine)
  apply(settings, null)
  watchRemote()
  // 从旧版本迁移上来的趁早写回当前版本；更新版本写的则由 write() 拦下，一个字节都不碰
  if (stored.migrated || storedMachine.migrated) persist(settings)
}

export function updateSettings(fn: (prev: Settings) => Settings): void {
  const prev = store.get().settings
  const next = fn(prev)
  if (next === prev) return
  apply(next)
  persist(next)
}

/** 删除资源等事务使用：取消待写的防抖快照，并等待本次设置真正落盘。 */
export async function updateSettingsNow(
  fn: (prev: Settings) => Settings,
): Promise<void> {
  persist.cancel()
  const prev = store.get().settings
  const next = fn(prev)
  const previousSnapshot = lastWritten
  const previousMachine = machine
  apply(next, null)
  try {
    await write(next)
  } catch (error) {
    lastWritten = previousSnapshot
    machine = previousMachine
    apply(prev, failureMessage(error, messages().settings.saveFailed))
    throw error
  }
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  if (enabled === isSyncEnabled()) return
  persist.cancel()
  const previousEnabled = isSyncEnabled()
  const previousSharedNewer = sharedNewer
  const previous = store.get().settings
  const current = { ...previous, syncEnabled: enabled }
  try {
    await switchArea(enabled)
    // 搬过去会整份覆盖目标存储区；那里若是更新版本写的设置，宁可不切也不能冲掉
    if (readStoredSettings(await currentArea().get('settings')).newer) {
      throw new NewerSettingsError()
    }
    sharedNewer = false
    // 设置和书签附加数据必须一起搬迁，任一失败都回到原存储区。
    // 本机那一半不参与搬迁 —— 它本来就一直待在 local。
    await Promise.all([write(current), setSyncEnabledForMeta()])
    apply(current, null)
    watchRemote()
  } catch (error) {
    await switchArea(previousEnabled)
    sharedNewer = previousSharedNewer
    lastWritten = JSON.stringify(splitSettings(previous).shared)
    const msg = error instanceof Error ? error.message : String(error)
    apply(previous, messages().settings.syncSwitchFailed(msg))
  }
}

function localBackgroundImageIds(settings: Settings): string[] {
  return settings.background.wallpapers
    .filter((wall) => wall.kind === 'local')
    .map((wall) => wall.id)
}

async function cleanupLocalBackgroundImages(ids: string[]): Promise<void> {
  const cleanup = await Promise.allSettled(ids.map((id) => removeImage(id)))
  cleanup.forEach((result) => {
    if (result.status === 'rejected') console.error('清理旧背景图片失败', result.reason)
  })
}

/** 只恢复背景页；本地图片二进制在新设置落盘后再清理。 */
export async function resetBackgroundSettings(): Promise<void> {
  const current = store.get().settings
  const localImageIds = localBackgroundImageIds(current)
  const sourceIds = current.background.folders
    .map((folder) => folder.linkedSourceId)
    .filter((id): id is string => !!id)
  await updateSettingsNow((prev) => ({
    ...prev,
    background: {
      ...DEFAULT_SETTINGS.background,
      wallpapers: [...DEFAULT_SETTINGS.background.wallpapers],
      folders: [],
      selectedIds: [...DEFAULT_SETTINGS.background.selectedIds],
      selectedFolderIds: [],
    },
  }))
  await Promise.all([
    cleanupLocalBackgroundImages(localImageIds),
    Promise.allSettled(sourceIds.map((id) => unlinkDirectory(id))),
  ])
}

export async function resetSettings(): Promise<void> {
  const current = store.get().settings
  const localImageIds = localBackgroundImageIds(current)
  const sourceIds = current.background.folders
    .map((folder) => folder.linkedSourceId)
    .filter((id): id is string => !!id)
  const next = { ...structuredClone(DEFAULT_SETTINGS), syncEnabled: isSyncEnabled() }
  await updateSettingsNow(() => next)
  await Promise.all([
    cleanupLocalBackgroundImages(localImageIds),
    Promise.allSettled(sourceIds.map((id) => unlinkDirectory(id))),
  ])
}

onAreaChange(() => {
  watchRemote()
})

export function useSettingsState(): SettingsState {
  return useStore(store)
}

export function useSettings(): Settings {
  return useStore(store).settings
}

export function getSettings(): Settings {
  return store.get().settings
}
