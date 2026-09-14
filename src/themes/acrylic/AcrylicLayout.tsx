import { ContentArea } from '../../components/ContentArea'
import { RightPanel } from '../../components/RightPanel'
import { Sidebar } from '../../components/Sidebar'
import { SidebarExpandHandles } from '../../components/SidebarExpandHandles'

/** 亚克力主题骨架：左目录树 + 中书签区 + 右动态栏。 */
export function AcrylicLayout() {
  return (
    <div className="bnt-app bnt-acrylic-layout">
      <Sidebar />
      <ContentArea />
      <RightPanel />
      <SidebarExpandHandles />
    </div>
  )
}
