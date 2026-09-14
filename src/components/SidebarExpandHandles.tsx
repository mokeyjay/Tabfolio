import { useEffect, useState } from 'react'
import { useApp } from '../app/AppContext'
import { updateSettings } from '../state/settingsStore'
import { IconChevronLeft, IconChevronRight } from './icons'
import { IconButton } from './ui'
import { useMessages } from '../i18n'

type VisibleEdge = 'left' | 'right' | null

/**
 * 侧栏收起后只在对应的视口边缘 10% 范围内露出展开按钮。
 *
 * 两套主题共用这一份命中逻辑，按钮本身仍作为布局的直接子元素，方便主题继续覆盖外观。
 */
export function SidebarExpandHandles() {
  const { settings } = useApp()
  const t = useMessages()
  const { leftOpen, rightOpen } = settings.sidebar
  const [visibleEdge, setVisibleEdge] = useState<VisibleEdge>(null)

  useEffect(() => {
    if (leftOpen && rightOpen) {
      setVisibleEdge(null)
      return
    }

    const updateVisibleEdge = (event: PointerEvent) => {
      const edgeWidth = window.innerWidth * 0.1
      let next: VisibleEdge = null
      if (!leftOpen && event.clientX <= edgeWidth) next = 'left'
      else if (!rightOpen && event.clientX >= window.innerWidth - edgeWidth) next = 'right'
      setVisibleEdge((current) => current === next ? current : next)
    }
    const hide = () => setVisibleEdge(null)

    window.addEventListener('pointermove', updateVisibleEdge, { passive: true })
    window.addEventListener('blur', hide)
    document.documentElement.addEventListener('mouseleave', hide)
    return () => {
      window.removeEventListener('pointermove', updateVisibleEdge)
      window.removeEventListener('blur', hide)
      document.documentElement.removeEventListener('mouseleave', hide)
    }
  }, [leftOpen, rightOpen])

  return (
    <>
      {!leftOpen && (
        <IconButton
          icon={<IconChevronRight size={15} />}
          title={t.sidebar.expand}
          className={`bnt-handle bnt-handle-left${visibleEdge === 'left' ? ' is-visible' : ''}`}
          onClick={() =>
            updateSettings((prev) => ({
              ...prev,
              sidebar: { ...prev.sidebar, leftOpen: true },
            }))
          }
        />
      )}
      {!rightOpen && (
        <IconButton
          icon={<IconChevronLeft size={15} />}
          title={t.right.expand}
          className={`bnt-handle bnt-handle-right${visibleEdge === 'right' ? ' is-visible' : ''}`}
          onClick={() =>
            updateSettings((prev) => ({
              ...prev,
              sidebar: { ...prev.sidebar, rightOpen: true },
            }))
          }
        />
      )}
    </>
  )
}
