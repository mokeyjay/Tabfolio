/**
 * 持久化结构的版本信封与逐级迁移。
 *
 * 落盘的不是裸数据，而是 `{ version, data }`：版本号只活在存储层，上层拿到的永远
 * 是当前版本的结构，不必到处判断「这是哪一版写的」。
 *
 * 读的时候分四种情况，调用方各自决定怎么处理：
 * - empty   从没存过
 * - invalid 不是信封、版本号非法、或迁移中途抛错 —— 当损坏数据看
 * - current 已是当前版本(可能刚从旧版迁上来，migrated 为 true，调用方应写回)
 * - newer   比本扩展认得的版本还新 —— 通常是另一台设备先更新了扩展。
 *           这时绝不能用旧结构把它写回去，否则新版本的数据会被冲掉
 */

type Plain = Record<string, unknown>

/** 把上一版的数据变成这一版。入参是上一版刚解出来的原始对象，不要假设它一定合法 */
export type Migration = (data: Plain) => Plain

/** key 是迁移的「目标」版本：`{ 2: v1ToV2, 3: v2ToV3 }` */
export type Migrations = Readonly<Record<number, Migration>>

export interface Versioned<T> {
  version: number
  data: T
}

export type Unpacked =
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'current'; data: unknown; migrated: boolean }
  | { status: 'newer'; data: unknown; version: number }

const isPlain = (value: unknown): value is Plain =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export function pack<T>(version: number, data: T): Versioned<T> {
  return { version, data }
}

export function unpack(raw: unknown, current: number, migrations: Migrations): Unpacked {
  if (raw === undefined) return { status: 'empty' }
  if (!isPlain(raw) || !('data' in raw)) return { status: 'invalid' }
  const { version } = raw
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { status: 'invalid' }
  }
  if (version > current) return { status: 'newer', data: raw.data, version }

  let data = raw.data
  try {
    for (let target = version + 1; target <= current; target++) {
      const migrate = migrations[target]
      // 这一版没动这块结构，就没有迁移函数，原样放行
      if (!migrate) continue
      if (!isPlain(data)) return { status: 'invalid' }
      data = migrate(data)
    }
  } catch (cause) {
    console.error(`迁移 v${version} -> v${current} 失败`, cause)
    return { status: 'invalid' }
  }
  return { status: 'current', data, migrated: version !== current }
}
