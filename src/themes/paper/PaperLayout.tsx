import { ContentArea } from '../../components/ContentArea'
import { RightPanel } from '../../components/RightPanel'
import { Sidebar } from '../../components/Sidebar'
import { SidebarExpandHandles } from '../../components/SidebarExpandHandles'
import { useMessages } from '../../i18n'

/**
 * 白纸上方的一句问候。
 *
 * 钟点在渲染时读一次就够 —— 新标签页存在的时间以分钟计，不值得为跨点再挂一个定时器。
 */
function Greeting() {
  const t = useMessages()
  const hour = new Date().getHours()
  const hello =
    hour < 11
      ? t.theme.paperGreetingMorning
      : hour < 18
        ? t.theme.paperGreetingAfternoon
        : t.theme.paperGreetingEvening

  return (
    <div className="bnt-paper-greeting">
      {hello}
      <span aria-hidden>👋</span>
    </div>
  )
}

/** 纸感主题骨架：左目录树 +「问候语 + 一张托住内容的白纸」+ 右动态栏 */
export function PaperLayout() {
  return (
    <div className="bnt-app bnt-paper-layout">
      <Sidebar />
      <div className="bnt-paper-stage">
        <Greeting />
        <ContentArea />
      </div>
      <RightPanel />
      <SidebarExpandHandles />
    </div>
  )
}
