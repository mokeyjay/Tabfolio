import { useEffect, useState } from 'react'
import type { LinkedWallpaper } from '../types'
import { createStore, useStore } from './store'
import { messages } from '../i18n'

const DB_NAME = 'bnt-background-directories'
const STORE_NAME = 'sources'
const DB_VERSION = 1

export interface IndexedDirectoryFile {
  path: string
  name: string
  mime: string
  size: number
  lastModified: number
  /** 缺省时位于关联源目录；显式 null 表示移动到了背景根目录。 */
  parentId?: string | null
  order: number
  handle: FileSystemFileHandle
}

export interface DirectorySource {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  files: IndexedDirectoryFile[]
  scannedAt: number
  permission: PermissionState | 'unknown'
}

interface StoredDirectorySource extends Omit<DirectorySource, 'permission'> {}

interface DirectoryState {
  ready: boolean
  sources: Record<string, DirectorySource>
}

interface PermissionCapableHandle extends FileSystemHandle {
  queryPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: { id?: string; mode?: 'read' | 'readwrite' }) =>
    Promise<FileSystemDirectoryHandle>
}

interface IterableDirectoryHandle extends FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
}

const store = createStore<DirectoryState>({ ready: false, sources: {} })
let openTask: Promise<IDBDatabase> | null = null

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error(messages().directory.indexedDbFailed))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error(messages().directory.transactionAborted))
    tx.onerror = () => reject(tx.error ?? new Error(messages().directory.transactionFailed))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  if (openTask) return openTask
  openTask = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error(messages().directory.openFailed))
  })
  return openTask
}

async function readAllSources(): Promise<StoredDirectorySource[]> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_NAME, 'readonly')
  return requestResult(tx.objectStore(STORE_NAME).getAll()) as Promise<StoredDirectorySource[]>
}

async function writeSource(source: DirectorySource): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const { permission: _permission, ...stored } = source
  tx.objectStore(STORE_NAME).put(stored)
  await transactionDone(tx)
}

async function deleteStoredSource(id: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).delete(id)
  await transactionDone(tx)
}

async function queryPermission(handle: FileSystemHandle): Promise<PermissionState | 'unknown'> {
  const query = (handle as PermissionCapableHandle).queryPermission
  if (!query) return 'unknown'
  try {
    return await query.call(handle, { mode: 'read' })
  } catch {
    return 'unknown'
  }
}

async function requestPermission(handle: FileSystemHandle): Promise<PermissionState> {
  const capable = handle as PermissionCapableHandle
  const current = await queryPermission(handle)
  if (current === 'granted') return current
  if (!capable.requestPermission) return current === 'unknown' ? 'granted' : current
  return capable.requestPermission({ mode: 'read' })
}

function isImage(file: File, path: string): boolean {
  return file.type.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(path)
}

async function enumerateImages(
  directory: FileSystemDirectoryHandle,
  prefix = '',
): Promise<Omit<IndexedDirectoryFile, 'order'>[]> {
  const out: Omit<IndexedDirectoryFile, 'order'>[] = []
  for await (const [name, handle] of (directory as IterableDirectoryHandle).entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'directory') {
      out.push(...await enumerateImages(handle as FileSystemDirectoryHandle, path))
      continue
    }
    try {
      const fileHandle = handle as FileSystemFileHandle
      const file = await fileHandle.getFile()
      if (!isImage(file, path)) continue
      out.push({
        path,
        name: file.name.replace(/\.[^.]+$/, ''),
        mime: file.type || 'application/octet-stream',
        size: file.size,
        lastModified: file.lastModified,
        handle: fileHandle,
      })
    } catch (cause) {
      console.warn(`跳过无法读取的本地背景：${path}`, cause)
    }
  }
  return out
}

async function scanSource(
  id: string,
  handle: FileSystemDirectoryHandle,
  previous?: DirectorySource,
): Promise<DirectorySource> {
  const files = await enumerateImages(handle)
  files.sort((a, b) => a.path.localeCompare(b.path, 'zh-CN'))
  const oldOrder = new Map(previous?.files.map((file) => [file.path, file.order]) ?? [])
  const oldFiles = new Map(previous?.files.map((file) => [file.path, file]) ?? [])
  let nextOrder = Math.max(-1, ...(previous?.files.map((file) => file.order) ?? [])) + 1
  return {
    id,
    name: handle.name,
    handle,
    files: files.map((file) => {
      const old = oldFiles.get(file.path)
      return {
        ...file,
        ...(old && 'parentId' in old ? { parentId: old.parentId } : {}),
        order: oldOrder.get(file.path) ?? nextOrder++,
      }
    }),
    scannedAt: Date.now(),
    permission: 'granted',
  }
}

function replaceSource(source: DirectorySource, invalidateImages = true): void {
  store.set((prev) => ({
    ready: true,
    sources: { ...prev.sources, [source.id]: source },
  }))
  if (invalidateImages) invalidateLinkedImages(source.id)
}

export function supportsDirectoryPicker(): boolean {
  return typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function'
}

export async function loadDirectorySources(): Promise<void> {
  try {
    const records = await readAllSources()
    const entries = await Promise.all(records.map(async (source) => [
      source.id,
      { ...source, permission: await queryPermission(source.handle) },
    ] as const))
    store.set({ ready: true, sources: Object.fromEntries(entries) })
  } catch (cause) {
    console.error('读取本地背景目录失败', cause)
    store.set({ ready: true, sources: {} })
  }
}

/** 必须直接由用户点击触发，浏览器才允许弹出目录选择器。 */
export async function linkDirectory(id: string): Promise<DirectorySource> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker
  if (!picker) throw new Error(messages().directory.unsupported)
  const handle = await picker({ id: 'bnt-wallpapers', mode: 'read' })
  // 重新关联同一目录时尽量保留用户已经调整过的扩展内排序。
  const source = await scanSource(id, handle, store.get().sources[id])
  await writeSource(source)
  replaceSource(source)
  return source
}

export async function refreshDirectory(id: string): Promise<DirectorySource> {
  const current = store.get().sources[id]
  if (!current) throw new Error(messages().directory.noRecord)
  const permission = await requestPermission(current.handle)
  if (permission !== 'granted') {
    replaceSource({ ...current, permission })
    throw new Error(messages().directory.noPermission)
  }
  const source = await scanSource(id, current.handle, current)
  await writeSource(source)
  replaceSource(source)
  return source
}

export async function unlinkDirectory(id: string): Promise<void> {
  await deleteStoredSource(id)
  store.set((prev) => {
    const sources = { ...prev.sources }
    delete sources[id]
    return { ...prev, sources }
  })
  invalidateLinkedImages(id)
}

function effectiveParent(source: DirectorySource, file: IndexedDirectoryFile): string | null {
  return file.parentId === undefined ? source.id : file.parentId
}

export async function moveDirectoryFile(
  sourceId: string,
  path: string,
  parentId: string | null,
  order: number,
): Promise<void> {
  const current = store.get().sources[sourceId]
  if (!current) throw new Error(messages().directory.noLinkedWallpaper)
  const source = {
    ...current,
    files: current.files.map((file) => {
      if (file.path !== path) return file
      if (parentId === sourceId) {
        const { parentId: _parentId, ...rest } = file
        return { ...rest, order }
      }
      return { ...file, parentId, order }
    }),
  }
  await writeSource(source)
  replaceSource(source, false)
}

export async function reorderDirectoryFilesInFolder(
  folderId: string | null,
  positions: Map<string, number>,
): Promise<void> {
  const tasks: Promise<void>[] = []
  for (const current of Object.values(store.get().sources)) {
    let changed = false
    const source = {
      ...current,
      files: current.files.map((file) => {
        if (effectiveParent(current, file) !== folderId) return file
        const order = positions.get(`linked:${current.id}:${file.path}`)
        if (order === undefined || order === file.order) return file
        changed = true
        return { ...file, order }
      }),
    }
    if (!changed) continue
    tasks.push(writeSource(source).then(() => replaceSource(source, false)))
  }
  await Promise.all(tasks)
}

export function directoryFilesInFolder(folderId: string | null): LinkedWallpaper[] {
  return Object.values(store.get().sources)
    .flatMap((source) => source.files
      .filter((file) => effectiveParent(source, file) === folderId)
      .map((file) => ({
        id: `linked:${source.id}:${file.path}`,
        kind: 'linked' as const,
        sourceId: source.id,
        path: file.path,
        name: file.name,
        mime: file.mime,
        size: file.size,
        lastModified: file.lastModified,
        parentId: folderId,
        order: file.order,
      })))
    .sort((a, b) => a.order - b.order)
}

export function getDirectorySources(): Record<string, DirectorySource> {
  return store.get().sources
}

export function useDirectorySources(): DirectoryState {
  return useStore(store)
}

const imageCache = new Map<string, { lastModified: number; url: string }>()
const imageInflight = new Map<string, Promise<string | null>>()

export function loadLinkedImage(wall: LinkedWallpaper): Promise<string | null> {
  const cached = imageCache.get(wall.id)
  if (cached?.lastModified === wall.lastModified) return Promise.resolve(cached.url)
  const inflight = imageInflight.get(wall.id)
  if (inflight) return inflight
  const task = (async () => {
    const source = store.get().sources[wall.sourceId]
    const indexed = source?.files.find((file) => file.path === wall.path)
    if (!source || !indexed || await queryPermission(source.handle) === 'denied') return null
    const file = await indexed.handle.getFile()
    const old = imageCache.get(wall.id)
    if (old) URL.revokeObjectURL(old.url)
    const url = URL.createObjectURL(file)
    imageCache.set(wall.id, { lastModified: file.lastModified, url })
    return url
  })().catch((cause: unknown) => {
    console.error(`读取本地目录背景失败：${wall.path}`, cause)
    return null
  }).finally(() => imageInflight.delete(wall.id))
  imageInflight.set(wall.id, task)
  return task
}

function invalidateLinkedImages(sourceId: string): void {
  const prefix = `linked:${sourceId}:`
  for (const [id, cached] of imageCache) {
    if (!id.startsWith(prefix)) continue
    URL.revokeObjectURL(cached.url)
    imageCache.delete(id)
    imageInflight.delete(id)
  }
}

/** undefined = 正在读取；null = 没有权限、文件不存在或读取失败。 */
export function useLinkedImage(wall: LinkedWallpaper | undefined): string | null | undefined {
  const cached = wall ? imageCache.get(wall.id) : undefined
  const [src, setSrc] = useState<string | null | undefined>(() =>
    cached && cached.lastModified === wall?.lastModified ? cached.url : wall ? undefined : null,
  )
  useEffect(() => {
    if (!wall) {
      setSrc(null)
      return
    }
    let alive = true
    setSrc(undefined)
    void loadLinkedImage(wall).then((value) => {
      if (alive) setSrc(value)
    })
    return () => {
      alive = false
    }
  }, [wall?.id, wall?.lastModified])
  return src
}
