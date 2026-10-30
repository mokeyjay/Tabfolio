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
import { loadAccentPalette } from './state/accentPaletteStore'
import { messages, setLanguage } from './i18n'
import { loadBookmarks, watchBookmarks } from './state/bookmarksStore'
import { loadDirectorySources } from './state/directoryStore'
import { ensureBingWallpaper } from './state/bingWallpaper'
import { ensurePrivacyConsent, hasPrivacyConsent } from './components/PrivacyConsent'
import './styles/base.css'

// 设置是异步读的，但标签标题和 <html lang> 等不了：先按浏览器语言定一版，
// 设置到位后 boot() 里再按用户的偏好覆盖一次。
const pageParams = new URLSearchParams(location.search)
const reviewPrivacy = pageParams.has('privacy')
const reviewLanguage = pageParams.get('lang')
setLanguage(reviewPrivacy && (reviewLanguage === 'en' || reviewLanguage === 'zh') ? reviewLanguage : 'auto')
const reactRoot = createRoot(document.getElementById('root')!)

let appearanceTask: Promise<void> | undefined
function loadAppearance(): Promise<void> {
  // 重新查看欢迎页和返回书签页共用这次加载，避免重复推进壁纸轮换。
  return appearanceTask ??= (async () => {
    await initArea()
    await Promise.all([loadSettings(), loadDirectorySources()])
    setLanguage(getSettings().language)
    if (getSettings().background.bingEnabled) await ensureBingWallpaper()
    await preloadActiveWallpaper(getSettings())
  })()
}

async function boot() {
  // 已同意的用户可以先恢复外观；首次同意前仅使用内置默认主题。
  if (reviewPrivacy && await hasPrivacyConsent()) await loadAppearance()
  await ensurePrivacyConsent(reactRoot, reviewPrivacy)
  if (reviewPrivacy) {
    // 查看后进入正常新标签页，刷新时无需再次进入欢迎页。
    pageParams.delete('privacy')
    pageParams.delete('lang')
    const search = pageParams.toString()
    history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`)
  }
  await loadAppearance()
  await Promise.all([loadBookmarks(), loadMeta(), loadStats(), loadAccentPalette()])
  watchBookmarks()

  reactRoot.render(
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
