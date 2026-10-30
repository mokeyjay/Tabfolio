/**
 * 持久化结构的版本信封与版本校验。
 *
 * 落盘的不是裸数据，而是 `{ version, data }`：版本号只活在存储层，上层拿到的永远
 * 是当前版本的结构，不必到处判断「这是哪一版写的」。
 *
 * 读的时候分四种情况，调用方各自决定怎么处理：
 * - empty   从没存过
 * - invalid 不是信封、版本号非法、或不是当前结构 —— 当无效数据看
 * - current 已是当前版本。
 * - newer   比本扩展认得的版本还新 —— 通常是另一台设备先更新了扩展。
 *           这时绝不能用旧结构把它写回去，否则新版本的数据会被冲掉
 */

type Plain = Record<string, unknown>

export interface Versioned<T> {
  version: number
  data: T
}

export type Unpacked =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'current'; data: unknown }
  | { status: 'newer'; data: unknown; version: number }

const isPlain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function pack<T>(version: number, data: T): Versioned<T> {
  return { version, data }
}

export function unpack(raw: unknown, current: number): Unpacked {
  if (raw === undefined) return { status: 'empty' }
  if (!isPlain(raw) || !('data' in raw)) return { status: 'invalid' }
  const { version } = raw
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { status: 'invalid' }
  }
  if (version > current) return { status: 'newer', data: raw.data, version }
  if (version !== current) return { status: 'invalid' }
  return { status: 'current', data: raw.data }
}
