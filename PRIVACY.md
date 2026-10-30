# 隐私权政策 / Privacy Policy

**签页集（Tabfolio）** — 最后更新：2026-10-17

---

## 中文

### 适用范围

本政策说明签页集如何访问、使用、保存和传输数据。签页集是一款在新标签页中展示和管理浏览器书签的扩展。扩展不运营用于收集用户数据的服务器，也不接入分析、广告或崩溃上报服务。

### 我们处理哪些数据，存在哪里

| 数据 | 用途 | 存放位置 | 是否离开本机 |
| --- | --- | --- | --- |
| 浏览器书签（标题、网址、目录结构） | 在新标签页上展示和整理书签 | 浏览器自带的书签存储 | 开启浏览器书签同步时，由浏览器按其自身政策同步 |
| 可同步的扩展设置、主色收藏和书签自定义图标配置 | 还原你的个性化配置 | 扩展同步开启时使用 `chrome.storage.sync`，关闭时使用 `chrome.storage.local` | 同步开启且浏览器账号同步可用时，由浏览器的同步服务处理 |
| 自定义图标和本地背景图的图片数据、本机背景配置 | 展示你自己挑选的图片 | `chrome.storage.local` | 否，始终留在本机 |
| 关联目录的访问句柄和文件索引 | 读取你授权的本地图片目录 | 扩展自身的 IndexedDB，图片文件保留在原目录 | 否，始终留在本机 |
| 书签访问次数 | 按访问频率排序 | `chrome.storage.local` | 否，始终留在本机 |
| Bing 壁纸信息缓存 | 减少重复请求 | `chrome.storage.local` | 缓存本身不上传，更新时会向 Bing 请求信息 |
| 本机随机标识和壁纸轮换进度 | 标记本地图片所属设备并恢复轮换位置 | `localStorage` | 否，始终留在本机 |
| 首次使用说明的同意结果 | 避免在同意前启动功能，以及在本机重复询问 | `chrome.storage.local` | 否，始终留在本机 |

扩展仅在提供本政策所述功能时处理相关数据。签页集不会将书签列表、扩展设置、本地图片或访问次数发送给开发者，也不会出售这些数据。浏览器自身的书签同步和扩展设置同步由浏览器服务按其政策处理；启用在线资源后，对应资源提供方会收到浏览器发出的网络请求，详情见下文。

首次使用时，扩展会先展示数据处理说明。在你点击「同意并开始使用」之前，不读取书签、不恢复同步设置、不记录访问次数，也不加载在线壁纸。你的同意结果仅记录在本机的 `chrome.storage.local` 中。

本扩展依照 [Chrome 应用商店用户数据政策](https://developer.chrome.com/docs/webstore/program-policies/policies#protecting-user-privacy)（包括 Limited Use 要求）处理用户数据。相关数据仅用于提供本政策说明的书签新标签页功能，不用于个性化广告或与这些功能无关的目的。

### 权限用途

| 权限 | 为什么需要 |
| --- | --- |
| `bookmarks` | 读取书签树以展示，以及在扩展内重命名、移动、删除书签。这是扩展的核心功能 |
| `storage` / `unlimitedStorage` | 保存上表中的设置与本地图片。`unlimitedStorage` 是因为本地背景图可能超出默认配额 |
| `favicon` | 读取浏览器**本地已缓存**的站点图标。该接口不发起任何网络请求 |
| 可选的 `https://www.bing.com/` | 仅在你点击 Bing 壁纸的授权按钮时申请，用于获取壁纸及其版权说明。关闭 Bing 壁纸不会自动撤销权限，你可随时在浏览器中撤销该授权 |

扩展默认不申请任何网站访问权限。

### 网络请求与第三方服务

除浏览器自身的账号同步外，以下在线功能会产生外部网络请求。启用后，资源可能在打开新标签页、展示相关内容或轮换壁纸时自动加载，无需每次手动点击：

1. 启用并授权「Bing 每日壁纸」后，向 `www.bing.com` 获取壁纸信息、版权说明和图片。打开新标签页或切换到 Bing 壁纸时，若信息缓存缺失、超过六小时或语言区域变化，会自动更新；手动刷新也会请求更新；
2. 你自己填入的在线壁纸地址、在线图标地址，在需要显示或预览时按你填的地址加载；
3. 你自己写的自定义 CSS 中的 `url()`、`@import` 等外部资源，按你写的地址加载。

扩展不会主动把书签列表、设置、本地图片或访问统计作为这些资源请求的附加数据上传。资源提供方仍会收到请求地址、IP 地址和浏览器发送的请求信息；你填写的地址本身也可能包含标识符。Bing 壁纸信息请求明确省略凭据，图片和 CSS 等资源请求是否携带 Cookie 等信息取决于浏览器策略及目标站点。

### 数据控制

你可以在扩展设置中关闭设置同步、清除访问次数，或移除扩展。关闭 Bing 壁纸功能不会自动撤销已授予的 Bing 网站权限；如需撤销，请在浏览器的扩展权限设置中操作。移除扩展不会删除浏览器书签或你保存在原目录中的图片。浏览器同步的数据如何保留或删除，取决于浏览器账号及同步服务的设置。

### 儿童隐私

本扩展不面向 13 岁以下儿童，也不会有意收集儿童的任何信息。

### 政策变更

若本政策发生变更，我们会更新本页顶部的日期，并在扩展的版本更新说明中注明。

### 联系方式

有任何疑问请联系：i@mok.moe

---

## English

### Scope

This policy describes how Tabfolio accesses, uses, stores, and transmits data. Tabfolio is an extension that displays and manages browser bookmarks on the new tab page. It does not operate a server to collect user data or use analytics, advertising, or crash-reporting services.

### What we handle, and where it lives

| Data | Purpose | Stored in | Leaves your device? |
| --- | --- | --- | --- |
| Browser bookmarks (titles, URLs, folder structure) | Displaying and organizing bookmarks on the new tab page | The browser's own bookmark store | Synced by your browser under its own policies when bookmark sync is enabled |
| Syncable extension settings, saved accent colors, and custom bookmark icon configuration | Restoring your configuration | `chrome.storage.sync` when extension sync is enabled; `chrome.storage.local` otherwise | Handled by the browser's sync service when extension sync is enabled and browser account sync is available |
| Image data for custom icons and local backgrounds, and device-specific background configuration | Showing the images you chose | `chrome.storage.local` | No, stays on this device |
| Linked directory access handles and file indexes | Reading the local image directories you authorize | The extension's own IndexedDB; image files stay in their original directories | No, stays on this device |
| Bookmark visit counts | Sorting by how often you visit | `chrome.storage.local` | No, never leaves your device |
| Cached Bing wallpaper information | Reducing repeated requests | `chrome.storage.local` | The cache itself is not uploaded; updates request information from Bing |
| Random local device identifier and wallpaper rotation progress | Identifying the device that owns local images and restoring rotation progress | `localStorage` | No, stays on this device |
| Consent to the first-use notice | Preventing features from starting before consent and avoiding repeated prompts on this device | `chrome.storage.local` | No, stays on this device |

Tabfolio processes data only as needed to provide the features described in this policy. It does not send bookmark lists, extension settings, local images, or visit counts to the developer, and it does not sell this data. Browser bookmark sync and extension settings sync are handled by the browser's services under their own policies. When you enable online resources, the relevant providers receive browser requests as described below.

On first use, the extension shows a data handling notice. Until you click "Agree and start using Tabfolio", it does not read bookmarks, restore synced settings, record visit counts, or load online wallpapers. Your consent is recorded only on this device in `chrome.storage.local`.

Tabfolio handles user data in accordance with the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies#protecting-user-privacy), including its Limited Use requirements. Data is used only to provide the bookmark new tab features described in this policy, not for personalized advertising or purposes unrelated to those features.

### Permission purposes

| Permission | Why it is needed |
| --- | --- |
| `bookmarks` | Reading the bookmark tree to display it, and renaming, moving, or deleting bookmarks from within the extension. This is the extension's core function |
| `storage` / `unlimitedStorage` | Saving the settings and local images listed above. `unlimitedStorage` is needed because local background images can exceed the default quota |
| `favicon` | Reading site icons **already cached locally** by your browser. This API makes no network requests |
| Optional `https://www.bing.com/` | Requested only when you click the Bing wallpaper authorization button, to fetch wallpapers and their copyright notices. Turning off Bing wallpaper does not automatically revoke this permission; you can revoke it in your browser at any time |

The extension requests no website access permissions by default.

### Network requests and third-party services

Apart from the browser's own account synchronization, the following online features make external requests. Once enabled, resources may load automatically when you open a new tab, display related content, or rotate wallpapers, without a separate click each time:

1. Fetching wallpaper information, copyright notices, and images from `www.bing.com` after you enable and authorize "Bing daily wallpaper". Opening a new tab or switching to Bing wallpaper automatically updates information if the cache is missing, more than six hours old, or for a different language region. Manual refresh also requests an update;
2. Loading online wallpaper URLs and online icon URLs you entered when they need to be displayed or previewed;
3. Loading external resources referenced by `url()`, `@import`, or similar rules in custom CSS you wrote.

The extension does not attach your bookmark list, settings, local images, or visit counts as additional data to these resource requests. Resource providers still receive the requested URL, your IP address, and request information sent by the browser; URLs you enter may themselves contain identifiers. Bing wallpaper information requests explicitly omit credentials. Whether image, CSS, and other resource requests carry cookies or similar information depends on browser policies and the destination site.

### Data controls

You can turn off extension settings sync, clear visit counts, or remove the extension in its settings or in the browser. Turning off Bing wallpaper does not automatically revoke the Bing site permission; revoke it in the browser's extension permissions if you no longer want to grant access. Removing the extension does not delete browser bookmarks or images stored in their original folders. Retention and deletion of data handled by browser sync depend on your browser account and sync settings.

### Children's privacy

This extension is not directed at children under 13 and does not knowingly collect any information from them.

### Policy updates

If this policy changes, we will update the date at the top of this page and describe the change in the extension's release notes.

### Contact

For questions, contact i@mok.moe.
