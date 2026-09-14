import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './app/AppContext'
import { ErrorBoundary } from './app/ErrorBoundary'
import { App } from './app/App'
import { initArea } from './state/area'
import { getSettings, loadSettings } from './state/settingsStore'
import { preloadActiveWallpaper } from './state/wallpaper'
import { loadMeta } from './state/metaStore'
import { loadStats } from './state/statsStore'
import { messages, setLanguage } from './i18n'
import { loadBookmarks, watchBookmarks } from './state/bookmarksStore'
import { loadDirectorySources } from './state/directoryStore'
import { ensureBingWallpaper } from './state/bingWallpaper'
import './styles/base.css'

// 设置是异步读的，但标签标题和 <html lang> 等不了：先按浏览器语言定一版，
// 设置到位后 boot() 里再按用户的偏好覆盖一次。
setLanguage('auto')

async function boot() {
  // 存储区(sync / local)要先定下来，设置和书签附加数据都从它读
  await initArea()
  // 设置先到位，首屏就能按用户的主题和布局直接画，不会闪一下默认样式
  await Promise.all([loadSettings(), loadMeta(), loadStats(), loadDirectorySources()])
  // 语言在渲染之前定下来，首屏和启动失败的兜底面板都得用它
  setLanguage(getSettings().language)
  if (getSettings().background.bingEnabled) await ensureBingWallpaper()
  // 背景图和书签一起读：本地图片存在 storage.local，不预读的话第一帧是纯底色，
  // 图片晚一拍才盖上来 —— 也就是打开新标签页时看到的那一下闪。
  await Promise.all([loadBookmarks(), preloadActiveWallpaper(getSettings())])
  watchBookmarks()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <AppProvider>
          <App />
        </AppProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

void boot().catch((cause: unknown) => {
  console.error('签页集启动失败', cause)
  const root = document.getElementById('root')
  if (!root) return
  const message = cause instanceof Error ? cause.message : String(cause)
  root.replaceChildren()
  const panel = document.createElement('div')
  panel.className = 'bnt-boot'
  panel.textContent = messages().boot.failed(message)
  root.append(panel)
})
