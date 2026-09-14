import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BookmarkNode, Settings } from '../types'
import { collectBookmarks, findByPath } from '../platform/bookmarks'
import { openUrl } from '../platform/tabs'
import { useBookmarksState } from '../state/bookmarksStore'
import { useSettings, updateSettings } from '../state/settingsStore'
import { useMeta, type MetaMap } from '../state/metaStore'
import { recordVisit, useStats } from '../state/statsStore'
import type { StatsMap } from '../state/statsStore'

export interface MenuTarget {
  x: number
  y: number
  node: BookmarkNode | null
}

export interface ConfirmSpec {
  title: string
  /** 一句话说清后果就够；要摆一份清单(比如主题推荐配置)时也可以给一段 JSX */
  message: ReactNode
  confirmLabel: string
  /** 不给就是「取消」。取消不总是「什么都不做」，有时它自己也是一个选择 */
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

export interface ToastSpec {
  id: number
  message: string
}

interface AppValue {
  settings: Settings
  root: BookmarkNode
  meta: MetaMap
  stats: StatsMap
  ready: boolean

  query: string
  setQuery(q: string): void

  currentFolder: BookmarkNode | null
  selectFolder(path: string): void

  searchResults: BookmarkNode[]

  expanded: Set<string>
  toggleExpanded(path: string): void
  setExpandedOpen(path: string, open: boolean): void

  open(node: BookmarkNode, newTab?: boolean): void

  editNode: BookmarkNode | null
  setEditNode(node: BookmarkNode | null): void

  settingsOpen: boolean
  setSettingsOpen(v: boolean): void

  menu: MenuTarget | null
  openMenu(e: React.MouseEvent, node: BookmarkNode | null): void
  closeMenu(): void

  confirm: ConfirmSpec | null
  askConfirm(spec: ConfirmSpec): void
  closeConfirm(): void

  toast: ToastSpec | null
  showToast(msg: string): void
  closeToast(id: number): void
}

const Ctx = createContext<AppValue | null>(null)

export function useApp(): AppValue {
  const value = useContext(Ctx)
  if (!value) throw new Error('useApp 必须在 AppProvider 内使用')
  return value
}

function ancestorsOf(path: string): string[] {
  const parts = path.split('/').filter(Boolean)
  const out: string[] = []
  let acc = ''
  for (const p of parts) {
    acc += `/${p}`
    out.push(acc)
  }
  return out
}

export function AppProvider({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const { root, ready } = useBookmarksState()
  const meta = useMeta()
  const stats = useStats()

  const [query, setQuery] = useState('')
  const [editNode, setEditNode] = useState<BookmarkNode | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menu, setMenu] = useState<MenuTarget | null>(null)
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)
  const [toast, setToast] = useState<ToastSpec | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toastId = useRef(0)

  /**
   * 本次会话里手动选中的目录。
   *
   * 「钉住」决定的是**打开新标签页时**默认落在哪个目录，而不是把界面锁死在那 ——
   * 所以会话内的选择优先级最高，只是不会被记成 lastFolderPath 之外的东西。
   */
  const [sessionPath, setSessionPath] = useState<string | null>(null)

  const desiredPath =
    sessionPath ??
    settings.selection.pinnedFolderPath ??
    settings.selection.lastFolderPath ??
    null

  const currentFolder = useMemo(() => {
    // 空路径代表浏览器书签树的虚拟根；多根节点浏览器需要用它展示“再上一层”。
    if (desiredPath === '') return root
    const hit = desiredPath ? findByPath(root, desiredPath) : null
    // 目录可能已经被改名或删除，回落到第一个顶层目录
    return hit ?? root.children?.find((c) => !c.url) ?? null
  }, [root, desiredPath])

  // 选中目录的祖先默认展开，用户手动折叠后不再强制
  const initialised = useRef(false)
  useEffect(() => {
    if (initialised.current || !currentFolder) return
    initialised.current = true
    setExpanded(new Set(ancestorsOf(currentFolder.path).slice(0, -1)))
  }, [currentFolder])

  const selectFolder = useCallback((path: string) => {
    // 点目录就是「给我看这个目录」，留着上一次的搜索词只会挡住结果
    setQuery('')
    setSessionPath(path)
    updateSettings((prev) => ({
      ...prev,
      selection: { ...prev.selection, lastFolderPath: path },
    }))
  }, [])

  const setExpandedOpen = useCallback((path: string, open: boolean) => {
    setExpanded((prev) => {
      if (prev.has(path) === open) return prev
      const next = new Set(prev)
      if (open) next.add(path)
      else next.delete(path)
      return next
    })
  }, [])

  const toggleExpanded = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    // 「当前目录」范围含子目录 —— 只搜直属书签几乎总是不够用
    const scopeRoot = settings.search.scope === 'folder' ? currentFolder : root
    if (!scopeRoot) return []
    return collectBookmarks(scopeRoot).filter((b) =>
      `${b.title} ${b.url ?? ''} ${b.displayPath}`.toLowerCase().includes(q),
    )
  }, [query, root, currentFolder, settings.search.scope])

  const showToast = useCallback((msg: string) => {
    toastId.current += 1
    setToast({ id: toastId.current, message: msg })
  }, [])

  const closeToast = useCallback((id: number) => {
    // 新提示已经顶替旧提示时，旧提示的退出回调不能把新的也一起关掉。
    setToast((current) => current?.id === id ? null : current)
  }, [])

  const open = useCallback((node: BookmarkNode, newTab = false) => {
    if (!node.url) return
    recordVisit(node.key)
    openUrl(node.url, { newTab })
  }, [])

  const openMenu = useCallback((e: React.MouseEvent, node: BookmarkNode | null) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null)
        setConfirm(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value: AppValue = {
    settings,
    root,
    meta,
    stats,
    ready,
    query,
    setQuery,
    currentFolder,
    selectFolder,
    searchResults,
    expanded,
    toggleExpanded,
    setExpandedOpen,
    open,
    editNode,
    setEditNode,
    settingsOpen,
    setSettingsOpen,
    menu,
    openMenu,
    closeMenu: () => setMenu(null),
    confirm,
    askConfirm: setConfirm,
    closeConfirm: () => setConfirm(null),
    toast,
    showToast,
    closeToast,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
