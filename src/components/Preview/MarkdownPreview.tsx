import { useMemo, useEffect, useRef, useCallback } from 'react'
import MarkdownIt from 'markdown-it'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useUIStore } from '../../store/uiStore'
import { useEditorStore } from '../../store/editorStore'
import { SelectionToolbar } from '../Editor/SelectionToolbar'
import './preview.css'

// 简易语法高亮：用正则为常见 token 着色
function highlightCode(str: string, _lang: string): string {
  let code = escapeHtml(str)

  // 通用 token 着色规则
  const rules: [RegExp, string][] = [
    [/\b(true|false|null|undefined|None|True|False|nil)\b/g, 'hl-literal'],
    [/\b(\d+\.?\d*)\b/g, 'hl-number'],
    [/(\/\/.*$)/gm, 'hl-comment'],
    [/(#.*$)/gm, 'hl-comment'],
    [/("""[\s\S]*?"""|'''[\s\S]*?'''|"[^"]*"|'[^']*'|`[^`]*`)/g, 'hl-string'],
    [/\b(function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|yield|delete|void|with|static|get|set|super|constructor)\b/g, 'hl-keyword'],
    [/\b(def|func|fn|lambda|class|struct|enum|interface|type|module|package|pub|priv|use|mod|impl|trait|match|loop|where|self|move|mut|ref|crate|macro)\b/g, 'hl-keyword'],
    [/\b(if|elif|else|for|while|with|as|is|not|and|or|in|pass|break|continue|return|yield|raise|try|except|finally|import|from|class|def|lambda|global|nonlocal|assert|del|async|await)\b/g, 'hl-keyword'],
    [/\b(int|float|double|string|bool|char|byte|long|short|void|any|never|object|array|map|set|list|dict|tuple|record|readonly|private|public|protected|abstract|virtual|override|sealed|final|volatile|transient|synchronized)\b/g, 'hl-type'],
    [/\b(String|Number|Boolean|Object|Array|Map|Set|Promise|Date|RegExp|Error|Symbol|BigInt|Uint8Array|Int32Array|Float64Array|Vec|Option|Result|Box|Rc|Arc)\b/g, 'hl-type'],
    [/(\/\*[\s\S]*?\*\/)/g, 'hl-comment'],
    [/(@\w+)/g, 'hl-decorator'],
  ]

  // 先保护字符串和注释，避免被其他规则干扰
  const tokens: string[] = []
  code = code.replace(/(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|`[\s\S]*?`)/g, (match) => {
    const idx = tokens.length
    tokens.push(`<span class="hl-string">${match}</span>`)
    return `__TOKEN${idx}__`
  })
  // 保护注释
  code = code.replace(/(\/\/.*$|#(?![a-zA-Z]).*$)/gm, (match) => {
    const idx = tokens.length
    tokens.push(`<span class="hl-comment">${match}</span>`)
    return `__TOKEN${idx}__`
  })

  for (const [re, cls] of rules) {
    if (cls === 'hl-string' || cls === 'hl-comment') continue
    code = code.replace(re, `<span class="${cls}">$&</span>`)
  }

  // 还原 token
  code = code.replace(/__TOKEN(\d+)__/g, (_, idx) => tokens[parseInt(idx)])
  return code
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang && lang !== 'mermaid') {
      return `<pre class="code-block"><code class="language-${lang}">${highlightCode(str, lang)}</code></pre>`
    }
    return ''
  },
})

function renderMath(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false })
  } catch {
    return `<code class="math-error">${displayMode ? `$$${latex}$$` : `$${latex}$`}</code>`
  }
}

function preprocess(content: string): string {
  const placeholders = new Map<string, string>()
  let counter = 0

  const save = (html: string): string => {
    const id = `%%PH${counter++}%%`
    placeholders.set(id, html)
    return id
  }

  // 1. Mermaid 代码块
  let result = content.replace(/```mermaid\n([\s\S]*?)```/g, (_match, code: string) => {
    const id = `mermaid-${counter}`
    const encoded = encodeURIComponent(code.trim())
    return save(`<div class="mermaid-wrapper" data-id="${id}" data-code="${encoded}"></div>`)
  })

  // 2. 块级数学 $$...$$
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    return save(`<div class="math-block">${renderMath(latex.trim(), true)}</div>`)
  })

  // 3. 行内数学 $...$
  result = result.replace(/\$([^$\n]+?)\$/g, (_match, latex: string) => {
    return save(renderMath(latex, false))
  })

  // 4. markdown-it 渲染
  let html = md.render(result)

  // 5. 还原占位符
  placeholders.forEach((rendered, ph) => {
    html = html.split(ph).join(rendered)
  })

  return html
}

interface MarkdownPreviewProps {
  content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRatio = useUIStore((s) => s.scrollRatio)
  const scrollSource = useUIStore((s) => s.scrollSource)
  const setScrollRatio = useUIStore((s) => s.setScrollRatio)

  // 格式化：在源 markdown 中查找预览区选中的文字并应用格式
  const handleFormat = useCallback((action: string, value?: string) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString()
    if (!text.trim()) return

    const { content: src, setContent } = useEditorStore.getState()

    // 在源内容中查找选中文字（支持文字被 HTML 标签包裹的情况）
    const idx = src.indexOf(text)
    if (idx === -1) return

    let replacement = text
    switch (action) {
      case 'bold': replacement = `**${text}**`; break
      case 'italic': replacement = `*${text}*`; break
      case 'strike': replacement = `~~${text}~~`; break
      case 'underline': replacement = `<u>${text}</u>`; break
      case 'color': replacement = `<span style="color:${value}">${text}</span>`; break
      case 'bgColor':
        if (value === 'transparent') return
        replacement = `<span style="background-color:${value};padding:0 2px;border-radius:2px">${text}</span>`
        break
      case 'fontSize': replacement = `<span style="font-size:${value}px">${text}</span>`; break
      case 'shrink':
      case 'grow': {
        const delta = action === 'shrink' ? -2 : 2
        const m = src.slice(Math.max(0, idx - 60), idx + text.length + 60)
          .match(new RegExp(`font-size:\\s*(\\d+)px[^>]*>([^<]*?)${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
        if (m) {
          const sz = Math.max(10, Math.min(72, parseInt(m[1]) + delta))
          // 替换整个 font-size span
          const before = src.slice(0, idx)
          const spanMatch = before.match(/<span style="font-size:\s*\d+px">$/)
          if (spanMatch) {
            const spanStart = idx - spanMatch[0].length
            const afterText = src.slice(idx + text.length)
            const closeMatch = afterText.match(/^<\/span>/)
            if (closeMatch) {
              const newContent = src.slice(0, spanStart) +
                `<span style="font-size:${sz}px">` + text + `</span>` +
                src.slice(idx + text.length + closeMatch[0].length)
              setContent(newContent)
              return
            }
          }
        }
        replacement = `<span style="font-size:${Math.max(10, 16 + delta)}px">${text}</span>`
        break
      }
    }

    const newContent = src.slice(0, idx) + replacement + src.slice(idx + text.length)
    setContent(newContent)
  }, [])

  const html = useMemo(() => preprocess(content), [content])

  // Mermaid 渲染
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const mermaidBlocks = container.querySelectorAll('.mermaid-wrapper')
    if (mermaidBlocks.length === 0) return

    const existing = (window as any).mermaid
    if (existing) {
      renderMermaid(mermaidBlocks)
      return
    }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'
    s.onload = () => {
      const m = (window as any).mermaid
      if (!m) return
      m.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        securityLevel: 'loose',
      })
      renderMermaid(mermaidBlocks)
    }
    document.head.appendChild(s)
  }, [html])

  // 预览滚动 → 通知 store
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      const maxScroll = scrollHeight - clientHeight
      if (maxScroll > 0) {
        setScrollRatio(scrollTop / maxScroll, 'preview')
      }
    }
    el.addEventListener('scroll', handler)
    return () => el.removeEventListener('scroll', handler)
  }, [setScrollRatio])

  // 编辑器滚动 → 同步预览
  useEffect(() => {
    const el = containerRef.current
    if (!el || scrollSource !== 'editor') return
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll > 0) {
      el.scrollTop = scrollRatio * maxScroll
    }
  }, [scrollRatio, scrollSource])

  return (
    <>
      <div
        ref={containerRef}
        className="prose prose-gray dark:prose-invert max-w-none p-6 h-full overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <SelectionToolbar onFormat={handleFormat} />
    </>
  )
}

async function renderMermaid(blocks: NodeListOf<Element>) {
  const m = (window as any).mermaid
  if (!m) return
  blocks.forEach(async (block) => {
    const code = decodeURIComponent(block.getAttribute('data-code') || '')
    const id = block.getAttribute('data-id') || ''
    try {
      const { svg } = await m.render(id, code)
      block.innerHTML = `<div class="mermaid-chart">${svg}</div>`
    } catch {
      block.innerHTML = `<div class="mermaid-error"><em>Mermaid 渲染失败</em></div>`
    }
  })
}
