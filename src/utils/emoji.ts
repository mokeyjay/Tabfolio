/**
 * 取出目录名开头的 emoji 当作目录图标。
 *
 * 「📁 工作」这种写法很常见，把 emoji 当图标显示、名字里再去掉它，列表会干净很多。
 *
 * 判定上刻意收紧了：`\p{Extended_Pictographic}` 会把 ™ © ® ‼ 这类字符也算进去，
 * 而「©公司」的首字符显然不该被当成图标。所以只接受星区字符(真正的 emoji 基本都在
 * U+1F000 以上)、带变体选择符 FE0F 的字符、区域旗帜，以及 keycap 序列。
 */

const KEYCAP = /^[#*0-9]️?⃣/
const FLAG = /^\p{RI}\p{RI}/u
// emoji 基座 + 可选的肤色/变体修饰 + 若干 ZWJ 连接的后续基座(如 👩‍💻)
const SEQUENCE =
  /^\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*)*/u

function looksLikeEmoji(match: string): boolean {
  if (match.includes('️') || match.includes('‍')) return true
  const cp = match.codePointAt(0) ?? 0
  return cp >= 0x1f000
}

export interface SplitTitle {
  /** 首字符是 emoji 时给出它，否则为 null */
  emoji: string | null
  /** 去掉 emoji 并去除前后空格后的名称 */
  label: string
}

export function splitLeadingEmoji(raw: string): SplitTitle {
  const title = raw.trim()
  if (!title) return { emoji: null, label: '' }

  const match =
    KEYCAP.exec(title)?.[0] ?? FLAG.exec(title)?.[0] ?? SEQUENCE.exec(title)?.[0]

  if (!match || !looksLikeEmoji(match)) return { emoji: null, label: title }

  const label = title.slice(match.length).trim()
  // 名字整个就是一个 emoji 时不要把标题清空
  return label ? { emoji: match, label } : { emoji: null, label: title }
}
