import type { BookmarkNode } from '../types'
import { bookmarksApi, findById, findByPath, normalizeTree, walkTree } from '../platform/bookmarks'
import { createStore, debounce, useStore } from './store'
import { getMeta, remapMetaKeys, removeMetaKeys } from './metaStore'
import { messages } from '../i18n'
import { updateSettings } from './settingsStore'
import { removeImage } from '../platform/blobs'
import { remapStatsKeys, removeStatsKeys } from './statsStore'

interface BookmarksState {
  ready: boolean
  root: BookmarkNode
}

const EMPTY_ROOT: BookmarkNode = {
  id: 'root',
  index: 0,
  title: '',
  path: '',
  displayPath: '',
  key: '',
  depth: -1,
  count: 0,
  children: [],
}

const store = createStore<BookmarksState>({ ready: false, root: EMPTY_ROOT })
let refreshQueue: Promise<void> = Promise.resolve()

function nodesById(root: BookmarkNode): Map<string, BookmarkNode> {
  const map = new Map<string, BookmarkNode>()
  walkTree(root, (node) => {
    map.set(node.id, node)
  })
  return map
}

async function performRefresh(): Promise<void> {
  const previous = store.get()
  const raw = await bookmarksApi.getTree()
  const root = normalizeTree(raw)

  if (previous.ready) {
    const before = nodesById(previous.root)
    const after = nodesById(root)
    const keyMappings = [...before.entries()].flatMap(([id, oldNode]) => {
        const newNode = after.get(id)
        return newNode && newNode.key !== oldNode.key
          ? [[oldNode.key, newNode.key] as const]
          : []
      })
    await Promise.all([remapMetaKeys(keyMappings), remapStatsKeys(keyMappings)])

    // 钉住/上次选中要跟随当前会话里的改名和移动。
    updateSettings((settings) => {
      let changed = false
      const selection = { ...settings.selection }
      for (const field of ['lastFolderPath', 'pinnedFolderPath'] as const) {
        const oldPath = selection[field]
        const oldNode = oldPath ? findByPath(previous.root, oldPath) : null
        const newNode = oldNode ? after.get(oldNode.id) : null
        if (newNode && newNode.path !== oldPath) {
          selection[field] = newNode.path
          changed = true
        }
      }
      return changed ? { ...settings, selection } : settings
    })
  }

  store.set({ ready: true, root })
}

function refreshBookmarks(): Promise<void> {
  const task = refreshQueue.then(performRefresh)
  refreshQueue = task.catch(() => {})
  return task
}

export async function loadBookmarks(): Promise<void> {
  await refreshBookmarks()
}

// 一次拖拽会连着触发 onMoved + onChildrenReordered，合并成一次重建
const reload = debounce(() => {
  void refreshBookmarks().catch((error: unknown) => {
    console.error('刷新书签树失败', error)
  })
}, 60)

export function watchBookmarks(): () => void {
  return bookmarksApi.subscribe(reload)
}

export function useBookmarksState(): BookmarksState {
  return useStore(store)
}

export function getRoot(): BookmarkNode {
  return store.get().root
}

/* ---------- 写操作。都会触发 onChanged，树由订阅统一重建 ---------- */

export async function createBookmark(input: {
  parentId: string
  title: string
  url?: string
  index?: number
}): Promise<string> {
  const node = await bookmarksApi.create(input)
  await refreshBookmarks()
  return node.id
}

export async function saveBookmark(
  node: BookmarkNode,
  changes: { title?: string; url?: string; parentId?: string },
): Promise<BookmarkNode> {
  const { parentId, ...bookmarkChanges } = changes
  await bookmarksApi.update(node.id, bookmarkChanges)
  if (parentId && parentId !== node.parentId) {
    await bookmarksApi.move(node.id, { parentId })
  }
  await refreshBookmarks()
  const updated = findById(store.get().root, node.id)
  if (!updated) throw new Error(messages().errors.bookmarkMissingAfterSave)
  return updated
}

export async function updateBookmark(
  node: BookmarkNode,
  changes: { title?: string; url?: string },
): Promise<void> {
  await bookmarksApi.update(node.id, changes)
  await refreshBookmarks()
}

export async function removeBookmark(node: BookmarkNode): Promise<void> {
  const removedNodes: BookmarkNode[] = [node]
  if (!node.url) {
    walkTree(node, (child) => {
      removedNodes.push(child)
    })
  }
  await bookmarksApi.remove(node.id, !node.url)
  await refreshBookmarks()

  const remainingKeys = new Set<string>()
  walkTree(store.get().root, (current) => {
    remainingKeys.add(current.key)
  })
  const removedMeta = await removeMetaKeys(
    removedNodes.map((current) => current.key).filter((key) => !remainingKeys.has(key)),
  )
  await removeStatsKeys(removedNodes.map((current) => current.key))
  const remainingLocalImageIds = new Set(
    Object.values(getMeta()).flatMap((meta) =>
      meta.icon?.kind === 'local' ? [meta.icon.id] : [],
    ),
  )
  const orphanedLocalImageIds = new Set(
    removedMeta.flatMap((meta) =>
      meta.icon?.kind === 'local' ? [meta.icon.id] : [],
    ),
  )
  const cleanup = await Promise.allSettled(
    [...orphanedLocalImageIds]
      .filter((id) => !remainingLocalImageIds.has(id))
      .map((id) => removeImage(id)),
  )
  cleanup.forEach((result) => {
    if (result.status === 'rejected') console.error('清理已删除书签的本地图标失败', result.reason)
  })
}

export async function moveBookmark(
  node: BookmarkNode,
  dest: { parentId?: string; index?: number },
): Promise<void> {
  await bookmarksApi.move(node.id, dest)
  await refreshBookmarks()
}
