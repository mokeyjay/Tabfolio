/** `npm run dev` 时用的假书签树，结构与 chrome.bookmarks 返回的一致。 */
type Raw = chrome.bookmarks.BookmarkTreeNode

/** 按需创建示例树，避免正式构建保留模块初始化的副作用。 */
export function createMockTree(): Raw[] {
  const F = (
    id: string,
    title: string,
    children: Raw[],
    parentId: string,
    index: number,
  ): Raw => ({ id, title, parentId, index, children, dateAdded: Date.now() - 8.64e7 })

  const B = (id: string, title: string, host: string, parentId: string, index: number): Raw => ({
    id,
    title,
    url: `https://${host}/`,
    parentId,
    index,
    dateAdded: Date.now() - Math.round(Math.random() * 3e9),
  })

  let seq = 100
  const mk = (parentId: string, items: [string, string][]): Raw[] =>
    items.map((it, i) => B(String(seq++), it[0], it[1], parentId, i))

  const design = F('20', '🎨 设计', [], '11', 0)
  design.children = mk('20', [
    ['Figma 项目文件', 'figma.com'],
    ['组件库规范', 'zeroheight.com'],
    ['Dribbble 收藏', 'dribbble.com'],
    ['Mobbin 案例', 'mobbin.com'],
    ['字体清单', 'fonts.google.com'],
    ['配色工具', 'oklch.com'],
    ['图标集', 'lucide.dev'],
    ['动效参考', 'cubic-bezier.com'],
    ['排版指南', 'practicaltypography.com'],
    ['无障碍检查', 'webaim.org'],
    ['截图工具', 'cleanshot.com'],
    ['灵感墙', 'cosmos.so'],
  ])

  const dev = F('21', '💻 开发', [], '11', 1)
  dev.children = mk('21', [
    ['MDN 文档', 'developer.mozilla.org'],
    ['GitHub 仓库', 'github.com'],
    ['Stack Overflow', 'stackoverflow.com'],
    ['Chrome 扩展文档', 'developer.chrome.com'],
    ['CSS 技巧', 'css-tricks.com'],
    ['Can I use', 'caniuse.com'],
    ['正则测试', 'regex101.com'],
    ['JSON 格式化', 'jsonformatter.org'],
    ['Vite 文档', 'vitejs.dev'],
    ['TypeScript 手册', 'typescriptlang.org'],
    ['性能面板指南', 'web.dev'],
    ['部署控制台', 'vercel.com'],
  ])

  const work = F('11', '工作', [], '1', 4)
  work.children = [
    design,
    dev,
    ...mk('11', [
      ['设计评审排期', 'docs.example.com'],
      ['季度目标', 'notion.so'],
      ['招聘看板', 'greenhouse.io'],
      ['预算表', 'sheets.google.com'],
      ['品牌资产库', 'brand.example.com'],
      ['客户反馈', 'dovetail.com'],
      ['竞品追踪', 'similarweb.com'],
      ['发布日历', 'calendar.example.com'],
    ]),
  ].map((n, i) => ({ ...n, index: i }))

  const study = F('12', '📚 学习', [], '1', 5)
  study.children = mk('12', [
    ['交互设计课程', 'interaction-design.org'],
    ['算法练习', 'leetcode.cn'],
    ['英语精读', 'economist.com'],
    ['公开课', 'coursera.org'],
    ['电子书架', 'books.example.com'],
    ['笔记模板', 'notion.so'],
    ['读书清单', 'douban.com'],
    ['播客订阅', 'podcasts.example.com'],
  ])

  const later = F('13', '  稍后读  ', [], '1', 6)
  later.children = mk('13', [
    ['长文：设计系统治理', 'medium.com'],
    ['访谈：产品直觉', 'every.to'],
    ['报告：浏览器生态', 'statista.com'],
    ['随笔：工具与思维', 'stratechery.com'],
    ['教程：动效原理', 'motion.dev'],
    ['清单：年度好文', 'news.ycombinator.com'],
    ['专栏：增长复盘', 'lenny.substack.com'],
    ['档案：早期互联网', 'archive.org'],
  ])

  const bar = F(
    '1',
    '书签栏',
    [
      ...mk('1', [
        ['Gmail', 'mail.google.com'],
        ['日历', 'calendar.google.com'],
        ['云盘', 'drive.google.com'],
        ['飞书', 'feishu.cn'],
      ]),
      work,
      study,
      later,
    ],
    '0',
    0,
  )
  bar.children = bar.children!.map((n, i) => ({ ...n, index: i }))

  const other = F(
    '2',
    '其他书签',
    mk('2', [
      ['未命名书签', 'example.com'],
      ['活动报名', 'huodongxing.com'],
      ['优惠券', 'coupon.example.com'],
      ['临时链接', 't.example.com'],
    ]),
    '0',
    1,
  )

  return [
    { id: '0', title: '', index: 0, children: [bar, other] },
  ]
}
