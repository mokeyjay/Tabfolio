import { createContext, useCallback, useContext, useId, useRef, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { BookmarkNode } from '../types'
import { moveBookmark } from '../state/bookmarksStore'
import { BookmarkIcon } from '../components/BookmarkIcon'
import { useMeta } from '../state/metaStore'
import { splitLeadingEmoji } from '../utils/emoji'
import { useApp } from './AppContext'
import { useMessages } from '../i18n'

/** 拖拽数据的两种形态：可排序的节点，和「放进这个目录」的落点 */
export type DragData =
  | { kind: 'node'; node: BookmarkNode }
  | { kind: 'into'; node: BookmarkNode }

/** 「放进目录」落点的 droppable id —— 和节点自身的 id 区分开 */
export function intoId(node: BookmarkNode, instance: string): string {
  return `into:${node.id}:${instance}`
}

interface DragValue {
  activeNode: BookmarkNode | null
  /** 刚刚结束一次拖拽 —— 卡片用它来吞掉拖拽后误触的 click */
  justDragged(): boolean
}

const Ctx = createContext<DragValue>({ activeNode: null, justDragged: () => false })

export function useDrag(): DragValue {
  return useContext(Ctx)
}

/**
 * 「把东西放进这个目录」的落点。
 *
 * 用在三个地方：目录树的行、目录区块的内容区、内容区最外层(= 当前目录)。
 * 后两个面积很大，靠碰撞检测按面积排序来保证它们的优先级最低。
 */
export function IntoZone({
  node,
  className,
  activeClassName = 'is-drop-into',
  children,
}: {
  node: BookmarkNode
  className: string
  activeClassName?: string
  children?: ReactNode
}) {
  const instance = useId()
  const { setNodeRef, isOver } = useDroppable({
    id: intoId(node, instance),
    data: { kind: 'into', node },
  })
  return (
    <div ref={setNodeRef} className={`${className}${isOver ? ` ${activeClassName}` : ''}`}>
      {children}
    </div>
  )
}

/** 目标目录是不是被拖节点自己或它的子孙 —— 拖进去会把子树弄丢 */
function isSelfOrDescendant(target: BookmarkNode, source: BookmarkNode): boolean {
  return (
    target.id === source.id ||
    (!source.url && target.path.startsWith(`${source.path}/`))
  )
}

/**
 * 落点判定。
 *
 * 指针命中的落点往往是嵌套的：一张卡片同时落在它所属的目录区块里，而区块又落在
 * 内容区里。按面积从小到大排序，最内层、最具体的那个自然胜出 —— 于是「拖到卡片之间」
 * 精确排序、「拖到区块空白处」进这个目录、「拖到内容区空白处」回到当前目录，
 * 三种意图各归各位。
 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  if (hits.length > 1) {
    const area = (id: (typeof hits)[number]['id']) => {
      const rect = args.droppableRects.get(id)
      return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY
    }
    return [...hits].sort((a, b) => area(a.id) - area(b.id))
  }
  if (hits.length) return hits
  return closestCenter(args)
}

export function DragProvider({ children }: { children: ReactNode }) {
  const t = useMessages()
  const { showToast } = useApp()
  const meta = useMeta()
  const [activeNode, setActiveNode] = useState<BookmarkNode | null>(null)
  const draggedAt = useRef(0)

  // 6px 的位移才算开始拖拽，这样单击打开书签不受影响
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined
    if (data?.kind === 'node') setActiveNode(data.node)
  }

  const finish = () => {
    setActiveNode(null)
    draggedAt.current = Date.now()
  }

  const onDragEnd = (e: DragEndEvent) => {
    const source = (e.active.data.current as DragData | undefined)?.node
    finish()
    const target = e.over?.data.current as DragData | undefined
    if (!source || !target) return

    if (target.kind === 'into') {
      if (isSelfOrDescendant(target.node, source)) return
      // 已经在这个目录里了，拖到空白处不该把它甩到末尾
      if (source.parentId === target.node.id) return
      void moveBookmark(source, { parentId: target.node.id }).catch((cause: unknown) => {
        showToast(t.drag.moveFailed(cause instanceof Error ? cause.message : String(cause)))
      })
      return
    }

    const dest = target.node
    if (dest.id === source.id || !dest.parentId) return
    if (isSelfOrDescendant(dest, source)) return

    // chrome.bookmarks.move 的 index 说的是「移出之前」的下标，同目录内往后移时
    // 浏览器会自己减一。所以想让节点最终落在 dest.index 上，往后拖要先加一 ——
    // 否则拖到紧邻的下一个位置会算出原地不动。
    const sameParent = source.parentId === dest.parentId
    const index = sameParent && dest.index > source.index ? dest.index + 1 : dest.index
    void moveBookmark(source, { parentId: dest.parentId, index }).catch((cause: unknown) => {
      showToast(t.drag.moveFailed(cause instanceof Error ? cause.message : String(cause)))
    })
  }

  const justDragged = useCallback(() => Date.now() - draggedAt.current < 250, [])

  const preview = activeNode ? splitLeadingEmoji(activeNode.title) : null

  return (
    <Ctx.Provider value={{ activeNode, justDragged }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={finish}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {activeNode && (
            <div className="bnt-card is-overlay">
              <BookmarkIcon node={activeNode} meta={meta[activeNode.key]} />
              <span className="bnt-card-body">
                <span className="bnt-card-title">{preview?.label || t.common.untitled}</span>
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </Ctx.Provider>
  )
}
