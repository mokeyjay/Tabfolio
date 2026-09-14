import { useId, type CSSProperties } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BookmarkNode } from '../types'
import { useApp } from '../app/AppContext'
import { intoId, useDrag } from '../app/DragProvider'
import { displayDomain } from '../utils/url'
import { splitLeadingEmoji } from '../utils/emoji'
import { useCardTint } from '../hooks/useCardTint'
import { BookmarkIcon } from './BookmarkIcon'
import { useMessages } from '../i18n'

/** 目录卡片中段的落点 —— 拖到这里是「放进这个目录」，拖到两侧则是排序 */
function FolderDropZone({ node }: { node: BookmarkNode }) {
  const instance = useId()
  const { setNodeRef, isOver } = useDroppable({
    id: intoId(node, instance),
    data: { kind: 'into', node },
  })
  return (
    <span ref={setNodeRef} className={`bnt-card-into${isOver ? ' is-over' : ''}`} aria-hidden />
  )
}

/**
 * 一张书签卡片。目录也用同一张卡片渲染：「默认」展示方案下，目录就是列表里的普通一项，
 * 除了图标不同没有任何区别，没必要为它另做一套组件。
 */
export function BookmarkCard({ node }: { node: BookmarkNode }) {
  const { settings, meta, open, selectFolder, openMenu } = useApp()
  const { justDragged, activeNode } = useDrag()
  const t = useMessages()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: node.id, data: { kind: 'node', node } })

  const isFolder = !node.url
  const { label } = splitLeadingEmoji(node.title)
  const tint = useCardTint(node, meta[node.key], settings.display.tintCards)

  const sub = isFolder
    ? t.card.folderCount(node.count)
    : settings.display.showDomain
      ? displayDomain(node.url!)
      : ''

  // 插入位置提示：同目录内往后拖时落在目标右侧，其余情况落在左侧
  const insertAfter =
    !!activeNode &&
    activeNode.parentId === node.parentId &&
    activeNode.index < node.index
  const dropClass =
    isOver && activeNode && activeNode.id !== node.id
      ? insertAfter
        ? ' is-drop-after'
        : ' is-drop-before'
      : ''

  /*
   * 只有真正在被 sortable 挪动时才接管 transform / transition。
   * useSortable 平时也会给出一个 `transition: transform linear`(时长 0s),
   * 内联下来会把 CSS 里的 hover 过渡整个盖掉，卡片就变成硬跳。
   */
  const dragStyle = transform
    ? { transform: CSS.Translate.toString(transform), transition }
    : undefined

  const style = tint
    ? ({
        ...dragStyle,
        '--bnt-card-tint': tint,
        '--bnt-tint-a': settings.display.tintStrength / 100,
      } as CSSProperties)
    : dragStyle

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bnt-card${isDragging ? ' is-dragging' : ''}${dropClass}${
        tint ? ' has-tint' : ''
      }`}
      title={isFolder ? label : `${label}\n${node.url}`}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // 拖拽结束时浏览器还会补一次 click，这里吞掉
        if (justDragged()) return
        if (isFolder) selectFolder(node.path)
        else open(node, e.metaKey || e.ctrlKey)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (isFolder) selectFolder(node.path)
        else open(node)
      }}
      onAuxClick={(e) => {
        // 中键在新标签页打开，和浏览器里的习惯一致
        if (e.button === 1 && !isFolder) {
          e.preventDefault()
          open(node, true)
        }
      }}
      onContextMenu={(e) => openMenu(e, node)}
    >
      <BookmarkIcon node={node} meta={meta[node.key]} />
      <span className="bnt-card-body">
        <span className="bnt-card-title">{label || t.common.untitled}</span>
        {sub && <span className="bnt-card-sub">{sub}</span>}
      </span>
      {isFolder && <FolderDropZone node={node} />}
    </div>
  )
}
