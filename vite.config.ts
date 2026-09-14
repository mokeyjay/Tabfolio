import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('.', import.meta.url))

// 扩展只有两个产物入口:新标签页(newtab.html)与 service worker。
// 用原生 Vite 多入口构建即可,不引入 CRXJS —— 少一层对 Vite 大版本敏感的依赖。
export default defineConfig({
  plugins: [react()],
  server: {
    // 普通网页开发环境受 CORS 限制，通过同源代理复现扩展获授权后的请求。
    proxy: {
      '/__bnt-bing-wallpaper': {
        target: 'https://www.bing.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__bnt-bing-wallpaper/, '/HPImageArchive.aspx'),
      },
    },
  },
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome114',
    rollupOptions: {
      input: {
        newtab: resolve(root, 'newtab.html'),
        background: resolve(root, 'src/background.ts'),
      },
      output: {
        // service worker 必须是固定路径,manifest 里要引用
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})
