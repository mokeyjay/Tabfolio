# 隐私权政策 / Privacy Policy

**签页集（Tabfolio）** — 最后更新：2026-09-12

---

## 中文

### 一句话结论

签页集不收集、不上传、不共享、不出售你的任何数据。所有书签、设置、图片和统计都只存在你自己的浏览器里。

### 我们处理哪些数据，存在哪里

| 数据 | 用途 | 存放位置 | 是否离开本机 |
| --- | --- | --- | --- |
| 浏览器书签（标题、网址、目录结构） | 在新标签页上展示和整理书签 | 浏览器自带的书签存储 | 否。仅在你开启了浏览器自身的账号同步时，由浏览器按其自身政策同步 |
| 扩展设置（主题、布局、背景、语言等） | 还原你的个性化配置 | `chrome.storage.sync` | 否。仅在你开启了浏览器自身的账号同步时，由浏览器在你的设备之间同步 |
| 自定义图标、本地背景图、关联目录索引 | 展示你自己挑选的图片 | `chrome.storage.local` | 否，始终留在本机 |
| 书签访问次数 | 按访问频率排序 | `chrome.storage.local` | 否，始终留在本机 |

扩展没有任何自有服务器，也没有接入任何统计、分析、广告或崩溃上报服务。上表之外的数据一概不处理。

### 权限说明

| 权限 | 为什么需要 |
| --- | --- |
| `bookmarks` | 读取书签树以展示，以及在扩展内重命名、移动、删除书签。这是扩展的核心功能 |
| `storage` / `unlimitedStorage` | 保存上表中的设置与本地图片。`unlimitedStorage` 是因为本地背景图可能超出默认配额 |
| `favicon` | 读取浏览器**本地已缓存**的站点图标。该接口不发起任何网络请求 |
| 可选的 `https://www.bing.com/` | 仅当你主动打开「Bing 每日壁纸」开关时才会申请，用于获取当天壁纸及其版权说明。关闭开关后可随时在浏览器中撤销该授权 |

扩展默认不申请任何网站访问权限。

### 对外的网络请求

只有以下几种情况会产生外部网络请求，且全部由你的操作直接触发：

1. 你打开「Bing 每日壁纸」后，向 `www.bing.com` 请求当天图片；
2. 你自己填入的在线壁纸地址、在线图标地址，按你填的地址加载；
3. 你自己写的自定义 CSS 中的 `url()`，按你写的地址加载。

这些请求只包含加载图片所必需的信息，不携带你的书签、设置或任何标识符。

### 儿童隐私

本扩展不面向 13 岁以下儿童，也不会有意收集儿童的任何信息。

### 政策变更

若本政策发生变更，我们会更新本页顶部的日期，并在扩展的版本更新说明中注明。

### 联系方式

有任何疑问请联系：i@mok.moe

---

## English

### In one sentence

Tabfolio does not collect, transmit, share, or sell any of your data. Your bookmarks, settings, images, and usage counts never leave your own browser.

### What we handle, and where it lives

| Data | Purpose | Stored in | Leaves your device? |
| --- | --- | --- | --- |
| Browser bookmarks (titles, URLs, folder structure) | Displaying and organizing bookmarks on the new tab page | The browser's own bookmark store | No. Synced only by your browser itself, under its own policy, if you have browser sync enabled |
| Extension settings (theme, layout, background, language, …) | Restoring your configuration | `chrome.storage.sync` | No. Synced only between your own devices by your browser, if you have browser sync enabled |
| Custom icons, local background images, linked folder indexes | Showing the images you chose | `chrome.storage.local` | No, never leaves your device |
| Bookmark visit counts | Sorting by how often you visit | `chrome.storage.local` | No, never leaves your device |

The extension has no server of its own and includes no analytics, tracking, advertising, or crash-reporting service. Nothing beyond the table above is processed.

### Permissions

| Permission | Why it is needed |
| --- | --- |
| `bookmarks` | Reading the bookmark tree to display it, and renaming, moving, or deleting bookmarks from within the extension. This is the extension's core function |
| `storage` / `unlimitedStorage` | Saving the settings and local images listed above. `unlimitedStorage` is needed because local background images can exceed the default quota |
| `favicon` | Reading site icons **already cached locally** by your browser. This API makes no network requests |
| Optional `https://www.bing.com/` | Requested only when you turn on "Bing daily wallpaper", to fetch that day's image and its copyright notice. You can revoke it in your browser at any time after turning the switch off |

The extension requests no website access permissions by default.

### Outbound network requests

External requests happen only in the following cases, all of them triggered directly by your own actions:

1. Fetching the day's image from `www.bing.com` after you enable "Bing daily wallpaper";
2. Loading online wallpaper URLs and online icon URLs that you entered yourself;
3. Loading `url()` resources in custom CSS that you wrote yourself.

These requests carry only what is required to load the image. They never include your bookmarks, settings, or any identifier.

### Children's privacy

This extension is not directed at children under 13 and does not knowingly collect any information from them.

### Changes to this policy

If this policy changes, we will update the date at the top of this page and note it in the extension's release notes.

### Contact

Questions: i@mok.moe
