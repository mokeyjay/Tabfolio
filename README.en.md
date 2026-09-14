# Tabfolio

**Your bookmarks, arranged your way.**

[简体中文](README.md) | English

Tabfolio is a free, open-source new tab extension for Chrome and Edge. It lays out the bookmarks you already have right on every new tab — no importing, no sign-up, it just works. With six distinct themes, wallpapers you can mix and match, and appearance settings down to each card, the page you open dozens of times a day finally feels like yours.

## Features

### 🎨 Six themes — more than a color swap

Every theme brings its own page layout, not just a new palette:

| Theme | Best for |
| --- | --- |
| **Frosted glass** | Translucent panels over your wallpaper: folder tree on the left, bookmarks in the middle, activity on the right — everything on one screen |
| **Acrylic** | A Windows 11–style tinted translucent material with wallpaper blur and fine grain |
| **Paper** | An opaque paper ground holding your bookmarks, with depth from tone instead of blur — calm and easy on the eyes |
| **Whitespace** | A clock and your bookmarks in a centered column — no panels, no cards, just breathing room and fine lines |
| **Columns** | Drill down folder by folder like Finder — great for deeply nested collections |
| **Columnar** | Spreads your folders out as newspaper-style sections so you can scan many at once |

When you switch themes, Tabfolio lists the colors, corner radius, card size and other settings the theme recommends, and lets you tick the ones you want — nothing you've already tuned gets silently overwritten.

### 📚 It's simply your browser bookmarks

- **Nothing to import**: Tabfolio reads and writes your browser bookmarks directly — changes made here show up in the browser, and vice versa
- **Drag to organize**: drag cards to reorder, drop them on a folder to move them in
- **Right-click to edit**: change a name, URL or folder, delete a bookmark, or open a whole folder at once (with a confirmation if there are a lot)
- **Pin a favorite folder**: make every new tab open straight to it

### 🗂 Show folders the way you like

Subfolders can be **hidden**, shown **inline**, **pinned** to the top, or **expanded** in place — and you can set a different style for the next level down, up to five levels deep. Expand the folders you use every day, tuck away the rest, and keep the page as tidy as you want.

### 🔍 Find anything, fast

- Press **⌘K** (**Ctrl+K** on Windows) to search your bookmarks anytime, optionally within the current folder only
- **Most visited** and **Recently added** get you back to your usual spots (Frosted glass, Acrylic and Paper themes)
- Hold ⌘ / Ctrl while clicking to open a bookmark in a new tab

### 🖼 Wallpapers, however you like them

- **Built-in gradients**: crisp at any resolution, plus a gradient maker to craft your own
- **Local and online images**: upload images or paste image URLs, and organize them into wallpaper folders
- **Link a local folder**: pick an image folder on your computer and everything in it becomes a wallpaper
- **Bing daily wallpaper**: a fresh image every day
- **Rotation**: in order or at random, on a timer or with every new tab
- **Effects**: blur, dimming, and cover / contain / stretch / tile fitting

### ✨ Every detail is yours to tweak

- Accent color, light / dark / follow system, corner radius, shadow strength
- Card width and height, content width, and the transparency and blur of glass and acrylic surfaces
- Replace any bookmark icon with an image of your choice; start a folder name with an emoji (like "📁 Work") and the emoji becomes its icon
- Tint bookmark cards automatically with the main color of each site's icon
- Power users can write **custom CSS** — every element has stable class names, so overrides are painless

### 🔒 Easy to sync, safe by design

- Sync your settings across devices through your browser account — or turn it off anytime
- Tabfolio has no servers and **collects and uploads no data**, with no analytics and no ads
- It requests no website access by default, so there's no "read your browsing history" warning at install
- Images you upload stay on the device they came from

See the [privacy policy](PRIVACY.md) for details.

### 🌐 English and Chinese

The interface follows your browser language by default, and you can switch it in settings.

## Installation

**Requirements**: Chrome or Edge 114 or later.

**Manual install**:

1. Download the latest `tabfolio-x.x.x.zip` from [Releases](../../releases) and unzip it (or build it yourself as described below)
2. Open `chrome://extensions` (`edge://extensions` in Edge) and turn on **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

When you open a new tab after installing, your browser may ask whether to keep the extension's change to the new tab page — choose to keep it.

## Building and development

Requires Node.js 18 or later.

```bash
npm install
npm run dev
```

`npm run dev` starts a regular web page (http://localhost:5173/newtab.html). There's no `chrome.*` API there, so the extension automatically falls back to in-memory sample bookmarks and `localStorage` — you can work on the entire UI without installing the extension.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build the extension into `dist/`, ready to load as an unpacked extension |
| `npm run watch` | Rebuild `dist/` whenever the code changes |
| `npm run pack` | Build and package a store-ready zip into `release/` |
| `npm run typecheck` | Run the type checker |


## License

[MIT](LICENSE)
