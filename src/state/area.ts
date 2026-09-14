import { localArea, syncArea, type Area } from '../platform/storage'

/**
 * 「设置和书签附加数据存哪」的单一裁决点。
 *
 * syncEnabled 开关本身只存本机 local —— 否则「关掉同步」这个动作会先同步出去，
 * 把用户其它设备上的同步也一起关掉。
 */
let enabled = true
const listeners = new Set<() => void>()

export async function initArea(): Promise<void> {
  enabled = (await localArea.get<boolean>('syncEnabled')) ?? true
}

export function currentArea(): Area {
  return enabled ? syncArea : localArea
}

export function isSyncEnabled(): boolean {
  return enabled
}

export async function switchArea(next: boolean): Promise<void> {
  enabled = next
  await localArea.set('syncEnabled', next)
  listeners.forEach((cb) => cb())
}

export function onAreaChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
