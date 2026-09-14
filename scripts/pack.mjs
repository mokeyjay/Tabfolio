// 打包上传到应用商店用的 zip。
// 商店要的是「解压出来就是 manifest.json」的结构，所以要在 dist/ 里面打包，
// 不能连 dist/ 这层目录一起塞进去。
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const OUT_DIR = join(ROOT, 'release')

if (!existsSync(join(DIST, 'manifest.json'))) {
  console.error('dist/manifest.json 不存在，先跑 npm run build')
  process.exit(1)
}

// 版本号以 manifest 为准 —— 商店只认它，package.json 对不上时应当暴露出来
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
if (manifest.version !== pkg.version) {
  console.error(`版本号不一致：manifest ${manifest.version} / package.json ${pkg.version}`)
  process.exit(1)
}

mkdirSync(OUT_DIR, { recursive: true })
const out = join(OUT_DIR, `${pkg.name}-${manifest.version}.zip`)
rmSync(out, { force: true })

try {
  // -r 递归、-X 不写 macOS 的扩展属性、-x 排除 Finder 留下的垃圾
  execFileSync('zip', ['-r', '-X', '-q', out, '.', '-x', '.DS_Store', '-x', '__MACOSX/*'], {
    cwd: DIST,
  })
} catch (cause) {
  console.error('打包失败，请确认系统里有 zip 命令', cause)
  process.exit(1)
}

console.log(`打包完成：${relative(ROOT, out)}`)
