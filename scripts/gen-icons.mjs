// 生成扩展图标 PNG。
// manifest 的 icons 只接受位图,而仓库里不想塞二进制资源,所以用一个最小的
// PNG 编码器(zlib 是 Node 内置的)按需生成,构建时自动跑。
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const SIZES = [16, 32, 48, 128]
const ACCENT = [0x00, 0x71, 0xe3]
const SS = 4 // 超采样倍数,用来得到抗锯齿边缘

function crc32(buf) {
  let c
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 圆角矩形命中测试,坐标为 0..1 归一化 */
function inRoundedRect(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r)
  const cy = Math.min(Math.max(y, r), 1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

/** 书签丝带形状:竖长条,底部挖一个向下张开的 V 形缺口 */
function inRibbon(x, y) {
  const x0 = 0.34, x1 = 0.66, y0 = 0.235, y1 = 0.775
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const notchTop = 0.6
  if (y < notchTop) return true
  const t = (y - notchTop) / (y1 - notchTop)
  return Math.abs(x - (x0 + x1) / 2) > t * ((x1 - x0) / 2)
}

function render(size) {
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0
      let fg = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size
          const v = (y + (sy + 0.5) / SS) / size
          if (inRoundedRect(u, v, 0.22)) {
            bg++
            if (inRibbon(u, v)) fg++
          }
        }
      }
      const total = SS * SS
      const alpha = bg / total
      const white = bg ? fg / bg : 0
      const i = (y * size + x) * 4
      // 丝带是白色,底是主题蓝,按覆盖比例混合
      px[i] = Math.round(ACCENT[0] * (1 - white) + 255 * white)
      px[i + 1] = Math.round(ACCENT[1] * (1 - white) + 255 * white)
      px[i + 2] = Math.round(ACCENT[2] * (1 - white) + 255 * white)
      px[i + 3] = Math.round(alpha * 255)
    }
  }
  return encodePng(size, size, px)
}

mkdirSync(OUT, { recursive: true })
for (const size of SIZES) {
  writeFileSync(join(OUT, `icon${size}.png`), render(size))
}
console.log(`icons written to public/icons (${SIZES.join(', ')})`)
