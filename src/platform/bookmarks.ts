import type { BookmarkNode } from '../types'
import { normalizeUrl } from '../utils/url'
import { isExtension } from './env'
import { messages } from '../i18n'
import { MOCK_TREE } from './mockBookmarks'

type Raw = chrome.bookmarks.BookmarkTreeNode

export interface CreateInput {
  parentId: string
  title: string
  url?: string
  index?: number
}

export interface BookmarksApi {
  getTree(): Promise<Raw[]>
  create(input: CreateInput): Promise<Raw>
  update(id: string, changes: { title?: string; url?: string }): Promise<void>
  remove(id: string, isFolder: boolean): Promise<void>
  move(id: string, dest: { parentId?: string; index?: number }): Promise<void>
  subscribe(cb: () => void): () => void
}

const chromeApi: BookmarksApi = {
  getTree: () => chrome.bookmarks.getTree(),
  create: (input) => chrome.bookmarks.create(input),
  update: async (id, changes) => {
    await chrome.bookmarks.update(id, changes)
  },
  remove: async (id, isFolder) => {
    if (isFolder) await chrome.bookmarks.removeTree(id)
    else await chrome.bookmarks.remove(id)
  },
  move: async (id, dest) => {
    await chrome.bookmarks.move(id, dest)
  },
  subscribe: (cb) => {
    const evts = [
      chrome.bookmarks.onCreated,
      chrome.bookmarks.onRemoved,
      chrome.bookmarks.onChanged,
      chrome.bookmarks.onMoved,
      chrome.bookmarks.onChildrenReordered,
      chrome.bookmarks.onImportEnded,
    ].filter(Boolean)
    // 各事件的回调签名不同，统一忽略参数、只当作「树变了」
    const handler = () => cb()
    evts.forEach((e) => e.addListener(handler as never))
    return () => evts.forEach((e) => e.removeListener(handler as never))
  },
}

/** 开发环境的内存实现，行为对齐 chrome.bookmarks 的语义(含 index 重排) */
const mockApi: BookmarksApi = (() => {
  const listeners = new Set<() => void>()
  let nextId = 10000
  const emit = () => listeners.forEach((cb) => cb())

  const findParent = (id: string, nodes: Raw[] = MOCK_TREE): Raw | null => {
    for (const n of nodes) {
      if (n.children?.some((c) => c.id === id)) return n
      if (n.children) {
        const hit = findParent(id, n.children)
        if (hit) return hit
      }
    }
    return null
  }
  const findNode = (id: string, nodes: Raw[] = MOCK_TREE): Raw | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) {
        const hit = findNode(id, n.children)
        if (hit) return hit
      }
    }
    return null
  }
  const reindex = (parent: Raw) => parent.children?.forEach((c, i) => (c.index = i))

  return {
    async getTree() {
      return MOCK_TREE
    },
    async create(input) {
      const parent = findNode(input.parentId)
      if (!parent) throw new Error(messages().errors.folderNotFound(input.parentId))
      parent.children ??= []
      const at = input.index ?? parent.children.length
      const node: Raw = {
        id: String(nextId++),
        parentId: parent.id,
        index: at,
        title: input.title,
        url: input.url,
        dateAdded: Date.now(),
      }
      if (!input.url) node.children = []
      parent.children.splice(at, 0, node)
      reindex(parent)
      emit()
      return node
    },
    async update(id, changes) {
      const node = findNode(id)
      if (!node) return
      if (changes.title !== undefined) node.title = changes.title
      if (changes.url !== undefined) node.url = changes.url
      emit()
    },
    async remove(id) {
      const parent = findParent(id)
      if (!parent?.children) return
      parent.children = parent.children.filter((c) => c.id !== id)
      reindex(parent)
      emit()
    },
    async move(id, dest) {
      const node = findNode(id)
      const from = findParent(id)
      if (!node || !from?.children) return
      const to = dest.parentId ? findNode(dest.parentId) : from
      if (!to) return
      to.children ??= []
      const oldIndex = from.children.findIndex((c) => c.id === id)
      // 对齐 Chrome:BookmarkModel::Move 里的 index 是「移出之前」的坐标，
      // 同一个父目录内往后移时浏览器会自己减一。
      let at = dest.index ?? to.children.length
      if (to === from && at > oldIndex) at -= 1
      from.children = from.children.filter((c) => c.id !== id)
      reindex(from)
      to.children.splice(Math.max(0, Math.min(at, to.children.length)), 0, node)
      node.parentId = to.id
      reindex(to)
      emit()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
})()

export const bookmarksApi: BookmarksApi = isExtension ? chromeApi : mockApi

/**
 * 把 chrome 返回的原始树转成带 path / key / count 的归一化树。
 * 根节点(id 为 0 的隐形容器)会被展开，顶层就是「书签栏」「其他书签」。
 */
export function normalizeTree(raw: Raw[]): BookmarkNode {
  const roots = raw.length === 1 && !raw[0].url ? (raw[0].children ?? []) : raw

  const walkSiblings = (
    nodes: Raw[],
    parentPath: string,
    parentDisplayPath: string,
    depth: number,
  ): BookmarkNode[] => {
    const occurrences = new Map<string, number>()
    return nodes.map((node) => {
      const isFolder = node.url === undefined
      const identity = isFolder ? node.title : normalizeUrl(node.url ?? '')
      const occurrenceKey = `${isFolder ? 'folder' : 'bookmark'}\0${identity}`
      const occurrence = occurrences.get(occurrenceKey) ?? 0
      occurrences.set(occurrenceKey, occurrence + 1)

      // 标题中的斜杠和同级重名都不会再让路径碰撞。
      const segment = `${isFolder ? 'f' : 'b'}:${encodeURIComponent(identity)}#${occurrence}`
      const path = `${parentPath}/${segment}`
      const displayPath = `${parentDisplayPath}/${node.title}`
      const children = isFolder
        ? walkSiblings(node.children ?? [], path, displayPath, depth + 1)
        : undefined
      return {
        id: node.id,
        parentId: node.parentId,
        index: node.index ?? 0,
        title: node.title,
        url: node.url,
        dateAdded: node.dateAdded,
        children,
        path,
        displayPath,
        key: `${isFolder ? 'folder' : 'bookmark'}:${path}`,
        count: children
          ? children.reduce((sum, child) => sum + (child.url ? 1 : child.count), 0)
          : 0,
        depth,
      }
    })
  }

  const top = walkSiblings(roots, '', '', 0)
  return {
    id: 'root',
    index: 0,
    title: '',
    path: '',
    displayPath: '',
    key: '',
    depth: -1,
    children: top,
    count: top.reduce((s, c) => s + c.count, 0),
  }
}

/** 深度优先遍历，回调返回 false 可跳过该子树 */
export function walkTree(
  node: BookmarkNode,
  visit: (n: BookmarkNode) => boolean | void,
): void {
  for (const child of node.children ?? []) {
    if (visit(child) === false) continue
    if (child.children) walkTree(child, visit)
  }
}

export function collectFolders(root: BookmarkNode): BookmarkNode[] {
  const out: BookmarkNode[] = []
  walkTree(root, (n) => {
    if (!n.url) out.push(n)
  })
  return out
}

export function collectBookmarks(root: BookmarkNode): BookmarkNode[] {
  const out: BookmarkNode[] = []
  walkTree(root, (n) => {
    if (n.url) out.push(n)
  })
  return out
}

export function findByPath(root: BookmarkNode, path: string): BookmarkNode | null {
  if (!path) return null
  let hit: BookmarkNode | null = null
  walkTree(root, (n) => {
    if (hit) return false
    if (n.path === path && !n.url) {
      hit = n
      return false
    }
  })
  return hit
}

export function findById(root: BookmarkNode, id: string): BookmarkNode | null {
  let hit: BookmarkNode | null = null
  walkTree(root, (n) => {
    if (hit) return false
    if (n.id === id) hit = n
  })
  return hit
}
