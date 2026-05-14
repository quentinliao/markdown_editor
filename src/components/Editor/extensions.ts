import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { bracketMatching } from '@codemirror/language'
import { Extension } from '@codemirror/state'
import { fileOps } from '../../lib/tauri'
import { useEditorStore } from '../../store/editorStore'

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1] || ''
}

function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
  }
  return map[mime] || 'png'
}

const isTauri = () => !!(window as any).__TAURI_INTERNALS__

// 解析 HTML 表格为 Markdown
function htmlTableToMarkdown(html: string): string | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null

  const rows: string[][] = []
  table.querySelectorAll('tr').forEach((tr) => {
    const cells: string[] = []
    tr.querySelectorAll('td, th').forEach((cell) => {
      cells.push(cell.textContent?.trim().replace(/\|/g, '\\|').replace(/\n/g, ' ') || '')
    })
    if (cells.length > 0) rows.push(cells)
  })
  if (rows.length === 0) return null

  // 对齐列数
  const maxCols = Math.max(...rows.map((r) => r.length))
  rows.forEach((r) => { while (r.length < maxCols) r.push('') })

  const lines: string[] = []
  // 表头
  lines.push('| ' + rows[0].join(' | ') + ' |')
  // 分隔行
  lines.push('| ' + rows[0].map(() => '------').join(' | ') + ' |')
  // 数据行
  for (let i = 1; i < rows.length; i++) {
    lines.push('| ' + rows[i].join(' | ') + ' |')
  }
  return lines.join('\n')
}

// 解析 TSV（Excel 粘贴）为 Markdown 表格
function tsvToMarkdown(text: string): string | null {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length < 1) return null

  const rows = lines.map((line) =>
    line.split('\t').map((cell) => cell.trim().replace(/\|/g, '\\|'))
  )
  const maxCols = Math.max(...rows.map((r) => r.length))
  if (maxCols < 2 && rows.length < 2) return null // 单格不算表格

  rows.forEach((r) => { while (r.length < maxCols) r.push('') })

  const md: string[] = []
  md.push('| ' + rows[0].join(' | ') + ' |')
  md.push('| ' + rows[0].map(() => '------').join(' | ') + ' |')
  for (let i = 1; i < rows.length; i++) {
    md.push('| ' + rows[i].join(' | ') + ' |')
  }
  return md.join('\n')
}

// 合并后的粘贴处理扩展
const pasteExtension = EditorView.domEventHandlers({
  paste(event, view) {
    const cd = event.clipboardData
    if (!cd) return false

    // 1. 检查图片
    for (const item of cd.items) {
      if (!item.type.startsWith('image/')) continue
      event.preventDefault()
      const file = item.getAsFile()
      if (!file) continue

      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        const ext = getExtFromMime(item.type)
        const timestamp = Date.now()
        const fileName = `image-${timestamp}.${ext}`
        const cursor = view.state.selection.main.head

        try {
          if (isTauri()) {
            const base64 = dataUrlToBase64(dataUrl)
            const filePath = useEditorStore.getState().filePath
            const dir = filePath ? filePath.substring(0, filePath.lastIndexOf('/')) : '.'
            const savePath = `${dir}/assets/${fileName}`
            await fileOps.saveImage(savePath, base64)
            const text = `![${fileName}](${savePath})`
            view.dispatch({ changes: { from: cursor, insert: text }, selection: { anchor: cursor + text.length } })
          } else {
            const text = `![${fileName}](${dataUrl})`
            view.dispatch({ changes: { from: cursor, insert: text }, selection: { anchor: cursor + text.length } })
          }
        } catch (e) {
          console.error('Image paste failed:', e)
        }
      }
      reader.readAsDataURL(file)
      return true
    }

    // 2. 检查 HTML 表格（Word 粘贴）
    const html = cd.getData('text/html')
    if (html && html.includes('<table')) {
      const md = htmlTableToMarkdown(html)
      if (md) {
        event.preventDefault()
        const cursor = view.state.selection.main.head
        const insert = '\n' + md + '\n'
        view.dispatch({ changes: { from: cursor, insert }, selection: { anchor: cursor + insert.length } })
        return true
      }
    }

    // 3. 检查 TSV（Excel 粘贴）
    const text = cd.getData('text/plain')
    if (text && text.includes('\t')) {
      const md = tsvToMarkdown(text)
      if (md) {
        event.preventDefault()
        const cursor = view.state.selection.main.head
        const insert = '\n' + md + '\n'
        view.dispatch({ changes: { from: cursor, insert }, selection: { anchor: cursor + insert.length } })
        return true
      }
    }

    return false
  },
})

export const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", monospace',
  },
  '.cm-content': { padding: '12px 16px' },
  '.cm-gutters': { borderRight: '1px solid #e2e8f0' },
})

export function buildExtensions(isDark: boolean, fontSize?: number): Extension[] {
  const theme = fontSize
    ? EditorView.theme({
        '&': { height: '100%', fontSize: `${fontSize}px` },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: '"JetBrains Mono", "Fira Code", "Menlo", monospace',
        },
        '.cm-content': { padding: '12px 16px' },
        '.cm-gutters': { borderRight: '1px solid #e2e8f0' },
      })
    : baseTheme
  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    bracketMatching(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    pasteExtension,
    theme,
    ...(isDark ? [oneDark] : []),
  ]
}
