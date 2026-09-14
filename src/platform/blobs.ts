import { localArea } from './storage'
import { messages } from '../i18n'

/**
 * 本地图片(背景图、自定义图标)。
 *
 * chrome.storage 只能存 JSON，所以图片按 data URL 存进 storage.local —— 配合
 * manifest 里的 "unlimitedStorage" 权限不受 10MB 限制。刻意不放 sync:
 * sync 总配额只有 100KB，一张图就撑爆了。
 */

const PREFIX = 'img:'

export interface StoredImage {
  dataUrl: string
  mime: string
  name: string
  size: number
}

export function newImageId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function putImage(id: string, file: File): Promise<StoredImage> {
  const dataUrl = await readFileAsDataUrl(file)
  const rec: StoredImage = { dataUrl, mime: file.type, name: file.name, size: file.size }
  await localArea.set(PREFIX + id, rec)
  return rec
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  return localArea.get<StoredImage>(PREFIX + id)
}

export async function removeImage(id: string): Promise<void> {
  await localArea.remove(PREFIX + id)
}

/**
 * 把图片等比缩放后重新编码，用于自定义图标 —— 用户随手丢一张 4MB 的图当 32px
 * 图标没必要，缩小后本地存储和渲染都轻松。
 */
export async function downscaleImage(file: File, max: number): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  const dataUrl = await readFileAsDataUrl(file)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(messages().errors.imageDecodeFailed))
    img.src = dataUrl
  })
  if (img.width <= max && img.height <= max) return file
  const scale = max / Math.max(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) return file
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.png', { type: 'image/png' })
}
