// 宣传截图用的演示实例：在独立的 Chrome for Testing 配置里加载 dist/，
// 写入演示书签与「最常访问」次数，逐个打开演示网址让浏览器缓存 favicon，
// 之后在终端按回车即可把当前新标签页截成商店规格的 1280×800 图片。
//
// 用法：npm run showcase [-- --lang en] [-- --reset]
// 品牌版 Chrome 从 137 起不再支持 --load-extension，所以这里用 Playwright 附带的
// Chrome for Testing；也可以用 CHROME_PATH 指定其他 Chromium 内核浏览器。
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { showcase } from './showcase-data.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SHOT_DIR = join(ROOT, 'release', 'screenshots')
const WIDTH = 1280
const HEIGHT = 800

// 依赖 macOS 的 -AppleLanguages 切换界面语言、sips 缩放截图，以及 Node 22 起内置的 WebSocket
if (process.platform !== 'darwin') {
  console.error('演示实例脚本目前只支持 macOS')
  process.exit(1)
}
if (typeof WebSocket === 'undefined') {
  console.error(`需要 Node 22 或更高版本，当前为 ${process.version}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'zh'
if (!showcase[lang]) {
  console.error(`不支持的语言：${lang}，可选 ${Object.keys(showcase).join(' / ')}`)
  process.exit(1)
}
const locale = lang === 'zh' ? 'zh-CN' : 'en-US'
const PROFILE = join(ROOT, '.showcase', lang)

if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error('dist/manifest.json 不存在，先跑 npm run build')
  process.exit(1)
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const cache = join(homedir(), 'Library', 'Caches', 'ms-playwright')
  const builds = existsSync(cache)
    ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
    : []
  for (const build of builds) {
    for (const arch of ['chrome-mac-arm64', 'chrome-mac']) {
      for (const app of [
        'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'Chromium.app/Contents/MacOS/Chromium',
      ]) {
        const bin = join(cache, build, arch, app)
        if (existsSync(bin)) return bin
      }
    }
  }
  console.error('找不到 Chrome for Testing，请运行 npx playwright install chromium，或用 CHROME_PATH 指定')
  process.exit(1)
}

/** 最小的 CDP 客户端：浏览器级连接 + flatten 模式的会话，只收发命令不订阅事件 */
class Cdp {
  #seq = 0
  #pending = new Map()

  constructor(ws) {
    this.ws = ws
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.#pending.has(msg.id)) {
        const { resolve, reject } = this.#pending.get(msg.id)
        this.#pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    })
  }

  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })
    return new Cdp(ws)
  }

  send(method, params = {}, sessionId) {
    const id = ++this.#seq
    this.ws.send(JSON.stringify({ id, method, params, sessionId }))
    return new Promise((resolve, reject) => this.#pending.set(id, { resolve, reject }))
  }


  async evaluate(sessionId, expression) {
    const { result, exceptionDetails } = await this.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    )
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function launch() {
  const portFile = join(PROFILE, 'DevToolsActivePort')
  // 同一配置再开一次，Chrome 会把请求交给已有实例然后退出；端口文件也不能删，否则旧实例就连不上了
  if (existsSync(portFile)) {
    const [port] = readFileSync(portFile, 'utf8').split('\n')
    const alive = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) })
      .then(() => true, () => false)
    if (alive) {
      console.error(`${relative(ROOT, PROFILE)} 已有演示实例在运行，请直接使用，或先在它的终端输入 q 退出`)
      process.exit(1)
    }
  }
  rmSync(portFile, { force: true })
  mkdirSync(PROFILE, { recursive: true })
  const chrome = spawn(findChrome(), [
    `--user-data-dir=${PROFILE}`,
    `--load-extension=${DIST}`,
    `--disable-extensions-except=${DIST}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-search-engine-choice-screen',
    `--lang=${locale}`,
    `--accept-lang=${locale},${lang}`,
    `--window-size=${WIDTH},${HEIGHT + 140}`,
    // macOS 上界面语言（书签栏等根目录名称）跟随 AppleLanguages，--lang 不生效。
    // 取值会被 Chrome 顺带当成网址打开一个标签页，启动后统一关掉
    '-AppleLanguages',
    `(${locale})`,
    'about:blank',
  ], { stdio: 'ignore' })
  chrome.on('exit', () => {
    console.log('浏览器已关闭')
    process.exit(0)
  })
  process.on('exit', () => chrome.kill())
  // 终端里 Ctrl+C 或被 kill 时也要带走浏览器，否则下次启动会被已有实例接管后立刻退出
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(0))

  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100)
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n')
  return Cdp.connect(`ws://127.0.0.1:${port}${path}`)
}

/** 未打包扩展的 ID 由目录绝对路径的 SHA-256 决定：取前 32 个十六进制位，0-f 映射为 a-p */
function extensionIdFor(dir) {
  const hex = createHash('sha256').update(dir).digest('hex').slice(0, 32)
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('')
}

/** 等扩展的 service worker 起来，确认 dist/ 加载成功 */
async function waitForExtension(cdp, extensionId) {
  for (let i = 0; i < 50; i++) {
    const { targetInfos } = await cdp.send('Target.getTargets')
    if (targetInfos.some((t) => t.type === 'service_worker' && t.url.startsWith(`chrome-extension://${extensionId}/`))) return
    await sleep(200)
  }
  throw new Error('扩展没有加载起来，确认 dist/ 能在 chrome://extensions 中正常加载')
}

/**
 * 打开开发者模式。--load-extension 启动时会绕过这项检查，但在扩展页点「重新加载」时不会：
 * 开发者模式关着的话，扩展会因 unsupportedDeveloperExtension 被直接停用。
 */
async function enableDeveloperMode(cdp) {
  const page = await openPage(cdp, 'chrome://extensions/', true)
  await cdp.evaluate(
    page.sessionId,
    'new Promise((resolve) => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, resolve))',
  )
  await cdp.send('Target.closeTarget', { targetId: page.targetId })
}

/** 直接以目标地址建页（从 about:blank 跳转到扩展页拿不到 chrome.* API），再轮询到加载完成 */
async function openPage(cdp, url, background = false) {
  const { targetId } = await cdp.send('Target.createTarget', { url, background })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  for (let i = 0; i < 80; i++) {
    // 导航途中执行上下文会被销毁，报错就当作还没加载好
    const ready = await cdp
      .evaluate(sessionId, `location.href !== 'about:blank' && document.readyState === 'complete'`)
      .catch(() => false)
    if (ready) break
    await sleep(250)
  }
  return { targetId, sessionId }
}

/** 在扩展页面里执行：清空书签栏与其他书签，写入演示数据和访问次数 */
async function seedInPage(data) {
  const [root] = await chrome.bookmarks.getTree()
  const pick = (type, id) => root.children.find((n) => n.folderType === type) ?? root.children.find((n) => n.id === id)
  const bar = pick('bookmarks-bar', '1')
  const other = pick('other', '2')
  for (const folder of [bar, other]) {
    for (const child of folder.children ?? []) {
      await (child.url ? chrome.bookmarks.remove(child.id) : chrome.bookmarks.removeTree(child.id))
    }
  }
  const add = async (parentId, items) => {
    for (const [title, value] of items) {
      if (Array.isArray(value)) {
        const folder = await chrome.bookmarks.create({ parentId, title })
        await add(folder.id, value)
      } else {
        await chrome.bookmarks.create({ parentId, title, url: value })
      }
    }
  }
  await add(bar.id, data.bar)
  await add(other.id, data.other)

  // 统计键与 src/platform/bookmarks.ts 的 normalizeTree、src/utils/url.ts 的 normalizeUrl 保持一致
  const normalizeUrl = (raw) => {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    return `${u.protocol}//${host}${u.port ? ':' + u.port : ''}${u.pathname.replace(/\/+$/, '')}${u.search}${u.hash}`
  }
  const stats = {}
  const now = Date.now()
  const walk = (nodes, parentPath) => {
    const occurrences = new Map()
    for (const node of nodes) {
      const isFolder = node.url === undefined
      const identity = isFolder ? node.title : normalizeUrl(node.url)
      const occurrenceKey = `${isFolder ? 'folder' : 'bookmark'}\0${identity}`
      const occurrence = occurrences.get(occurrenceKey) ?? 0
      occurrences.set(occurrenceKey, occurrence + 1)
      const path = `${parentPath}/${isFolder ? 'f' : 'b'}:${encodeURIComponent(identity)}#${occurrence}`
      if (isFolder) walk(node.children ?? [], path)
      else if (data.visits[node.url]) {
        stats[`bookmark:${path}`] = { count: data.visits[node.url], last: now - Math.round(Math.random() * 8.64e7) }
      }
    }
  }
  const [fresh] = await chrome.bookmarks.getTree()
  walk(fresh.children, '')
  // 演示配置直接视为已同意数据处理说明，值与 PrivacyConsent 的 NOTICE_VERSION 一致
  await chrome.storage.local.set({ stats, privacyConsent: 1 })
  return Object.keys(stats).length
}

function collectUrls(items, out = []) {
  for (const [, value] of items) {
    if (Array.isArray(value)) collectUrls(value, out)
    else out.push(value)
  }
  return out
}

/** 逐个打开演示网址，让浏览器把图标写进本地 favicon 缓存，扩展的 _favicon/ 才取得到 */
async function warmFavicons(cdp, urls, dwell) {
  const queue = [...urls]
  let done = 0
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift()
      try {
        const { targetId } = await openPage(cdp, url, true)
        // 图标在页面加载完之后才抓取，跳转多、加载慢的站点需要多等一会儿
        await sleep(dwell)
        await cdp.send('Target.closeTarget', { targetId })
      } catch (error) {
        console.warn(`  打开失败：${url}（${error.message}）`)
      }
      process.stdout.write(`\r  预热网站图标 ${++done}/${urls.length}`)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  process.stdout.write('\n')
}

/** 在扩展页面里比对 _favicon/ 的返回值：和一个不存在站点的默认图标相同，就是还没缓存到 */
function missingFavicons(cdp, sessionId, urls) {
  return cdp.evaluate(sessionId, `(async (urls) => {
    const icon = async (pageUrl) => {
      const res = await fetch(chrome.runtime.getURL('/_favicon/') + '?size=32&pageUrl=' + encodeURIComponent(pageUrl))
      return new Uint8Array(await res.arrayBuffer()).join()
    }
    const fallback = await icon('https://showcase.invalid/')
    const missing = []
    for (const url of urls) if (await icon(url) === fallback) missing.push(url)
    return missing
  })(${JSON.stringify(urls)})`)
}

/** 把窗口调到视口恰好 1280×800，所见即所截 */
async function fitWindow(cdp, targetId, sessionId) {
  const { windowId, bounds } = await cdp.send('Browser.getWindowForTarget', { targetId })
  const [w, h] = await cdp.evaluate(sessionId, '[innerWidth, innerHeight]')
  await cdp.send('Browser.setWindowBounds', {
    windowId,
    bounds: { width: bounds.width + WIDTH - w, height: bounds.height + HEIGHT - h },
  })
}

async function capture(cdp, extensionId) {
  // 覆盖后的新标签页在 CDP 里显示为 chrome://newtab/，只能进页面看实际来源
  const { targetInfos } = await cdp.send('Target.getTargets')
  const origin = `chrome-extension://${extensionId}`
  let target = null
  let fallback = null
  for (const page of targetInfos.filter((t) => t.type === 'page')) {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true })
    const [pageOrigin, visibility] = await cdp
      .evaluate(sessionId, '[location.origin, document.visibilityState]')
      .catch(() => [])
    if (pageOrigin === origin && !target && visibility === 'visible') target = sessionId
    else if (pageOrigin === origin && !fallback) fallback = sessionId
    else await cdp.send('Target.detachFromTarget', { sessionId })
  }
  // 窗口被其他应用挡住时页面都算不可见，就退回第一个签页集页面
  if (target && fallback) await cdp.send('Target.detachFromTarget', { sessionId: fallback })
  target ??= fallback
  if (!target) {
    console.log('没找到签页集新标签页，请先在浏览器里打开一个新标签页')
    return
  }
  // 按 2 倍像素渲染再缩到 1280×800，比直接 1 倍截图更清晰
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: false }, target)
  await sleep(800)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, target)
  await cdp.send('Emulation.clearDeviceMetricsOverride', {}, target)
  await cdp.send('Target.detachFromTarget', { sessionId: target })

  mkdirSync(SHOT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  const hiRes = join(SHOT_DIR, `${lang}-${stamp}@2x.png`)
  const out = join(SHOT_DIR, `${lang}-${stamp}.png`)
  writeFileSync(hiRes, Buffer.from(data, 'base64'))
  execFileSync('sips', ['-z', String(HEIGHT), String(WIDTH), hiRes, '--out', out], { stdio: 'ignore' })
  console.log(`已保存 ${relative(ROOT, out)}（另有 2 倍图 @2x）`)
}

if (args.includes('--reset')) rmSync(PROFILE, { recursive: true, force: true })
const marker = join(PROFILE, '.seeded')
const cdp = await launch()
const extensionId = extensionIdFor(DIST)
await waitForExtension(cdp, extensionId)
await enableDeveloperMode(cdp)

if (!existsSync(marker)) {
  const data = showcase[lang]
  console.log('写入演示书签…')
  const page = await openPage(cdp, `chrome-extension://${extensionId}/newtab.html`, true)
  const count = await cdp.evaluate(page.sessionId, `(${seedInPage})(${JSON.stringify(data)})`)
  console.log(`  已写入，预置 ${count} 条访问次数`)
  const urls = [...new Set(collectUrls([...data.bar, ...data.other]))]
  await warmFavicons(cdp, urls, 2500)
  let missing = await missingFavicons(cdp, page.sessionId, urls)
  if (missing.length) {
    console.log(`  ${missing.length} 个站点还没有图标，延长等待再试一次`)
    await warmFavicons(cdp, missing, 8000)
    missing = await missingFavicons(cdp, page.sessionId, missing)
  }
  if (missing.length) {
    console.log(`  以下站点仍没有图标，会显示浏览器的默认图标；可在实例里手动打开一次，或换掉这些网址：`)
    for (const url of missing) console.log(`    ${url}`)
  }
  await cdp.send('Target.closeTarget', { targetId: page.targetId })
  writeFileSync(marker, new Date().toISOString())
}

// 只留一个新标签页：启动时的空白页，以及 -AppleLanguages 的取值被 Chrome 当成网址打开的页面都关掉。
// 后者可能比 CDP 连上更晚出现，所以在新标签页加载完之后再统一清理
const main = await openPage(cdp, 'chrome://newtab/')
const { targetInfos } = await cdp.send('Target.getTargets')
for (const t of targetInfos) {
  if (t.type === 'page' && t.targetId !== main.targetId) await cdp.send('Target.closeTarget', { targetId: t.targetId })
}
await fitWindow(cdp, main.targetId, main.sessionId)
await cdp.send('Target.detachFromTarget', { sessionId: main.sessionId })

console.log(`\n演示实例已就绪（${locale}，配置目录 ${relative(ROOT, PROFILE)}）。`)
console.log('在浏览器里调好主题与壁纸后，回到终端按回车截图；输入 q 回车退出。')
const rl = createInterface({ input: process.stdin })
rl.on('line', async (line) => {
  if (line.trim() === 'q') process.exit(0)
  try {
    await capture(cdp, extensionId)
  } catch (error) {
    console.error('截图失败', error)
  }
})
