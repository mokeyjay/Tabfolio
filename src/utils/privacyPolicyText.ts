/** 将政策文档中的标题、链接和表格转换成可直接阅读的纯文本，保留所有说明与网址。 */
export function privacyPolicyText(markdown: string): string {
  const inlineText = (text: string) => text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, url: string) =>
      /[\u3400-\u9fff]/u.test(label) ? `${label}（${url}）` : `${label} (${url})`)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')

  const lines = markdown.split(/\r?\n/)
  const output: string[] = []
  let headers: string[] | null = null

  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => inlineText(cell.trim()))
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue
      if (!headers) {
        headers = cells
        continue
      }
      // 每行表格展开成一个说明段落，避免窄屏出现横向滚动。
      output.push(cells[0])
      cells.slice(1).forEach((cell, index) => {
        const label = headers![index + 1]
        const separator = /[\u3400-\u9fff]/u.test(label) ? '：' : ': '
        output.push(`${label}${separator}${cell}`)
      })
      output.push('')
      continue
    }

    headers = null
    if (/^\s*[-*_]{3,}\s*$/.test(line)) continue
    output.push(inlineText(line.replace(/^#{1,6}\s+/, '')))
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
