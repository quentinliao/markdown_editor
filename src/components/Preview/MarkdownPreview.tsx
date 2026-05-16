import { useMemo, useEffect, useRef, useCallback } from 'react'
import { createRoot, Root } from 'react-dom/client'
import MarkdownIt from 'markdown-it'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)
import hljs from 'highlight.js/lib/core'
// 按需注册常用语言
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import markdown from 'highlight.js/lib/languages/markdown'
import shell from 'highlight.js/lib/languages/shell'
import diff from 'highlight.js/lib/languages/diff'
import plaintext from 'highlight.js/lib/languages/plaintext'
import { useEditorStore } from '../../store/editorStore'
import { SelectionToolbar } from '../Editor/SelectionToolbar'
import { CanvasBlock, CanvasData } from '../Canvas/CanvasBlock'
import { registerPreview, unregisterPreview } from '../../lib/scrollSync'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import './preview.css'

// 注册语言到 highlight.js
const registeredLanguages: Record<string, boolean> = {}
function registerLang(name: string, lang: any) {
  if (!registeredLanguages[name]) {
    hljs.registerLanguage(name, lang)
    registeredLanguages[name] = true
  }
}
registerLang('javascript', javascript)
registerLang('js', javascript)
registerLang('typescript', typescript)
registerLang('ts', typescript)
registerLang('python', python)
registerLang('py', python)
registerLang('rust', rust)
registerLang('go', go)
registerLang('java', java)
registerLang('cpp', cpp)
registerLang('c', cpp)
registerLang('csharp', csharp)
registerLang('cs', csharp)
registerLang('css', css)
registerLang('html', xml)
registerLang('xml', xml)
registerLang('svg', xml)
registerLang('json', json)
registerLang('yaml', yaml)
registerLang('yml', yaml)
registerLang('bash', bash)
registerLang('sh', bash)
registerLang('shell', shell)
registerLang('sql', sql)
registerLang('markdown', markdown)
registerLang('md', markdown)
registerLang('diff', diff)
registerLang('plaintext', plaintext)
registerLang('text', plaintext)

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
    if (lang && lang !== 'mermaid' && lang !== 'canvas' && lang !== 'geojson' && lang !== 'topojson' && lang !== 'stl' && lang !== 'chart' && lang !== 'sequence' && lang !== 'flow' && lang !== 'flowchart' && lang !== 'mindmap') {
      if (registeredLanguages[lang]) {
        try {
          const result = hljs.highlight(str, { language: lang, ignoreIllegals: true })
          return `<pre class="code-block"><code class="language-${lang} hljs">${result.value}</code></pre>`
        } catch {
          // fallback to auto-detection
        }
      }
      // 尝试自动检测语言
      try {
        const result = hljs.highlightAuto(str)
        return `<pre class="code-block"><code class="hljs">${result.value}</code></pre>`
      } catch {
        // fallback to escaped plain text
      }
    }
    // 无语言标记或 canvas/mermaid：返回转义文本
    return `<pre class="code-block"><code>${escapeHtml(str)}</code></pre>`
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

  let result = content.replace(/```mermaid\n([\s\S]*?)```/g, (_match, code: string) => {
    const id = `mermaid-${counter}`
    const encoded = encodeURIComponent(code.trim())
    return save(`<div class="mermaid-wrapper" data-id="${id}" data-code="${encoded}"></div>`)
  })

  // sequence 代码块 → 转换为 mermaid sequenceDiagram
  result = result.replace(/```sequence\n([\s\S]*?)```/g, (_match, code: string) => {
    const mermaidCode = sequenceToMermaid(code.trim())
    const id = `mermaid-${counter}`
    const encoded = encodeURIComponent(mermaidCode)
    return save(`<div class="mermaid-wrapper" data-id="${id}" data-code="${encoded}"></div>`)
  })

  // flow / flowchart 代码块 → 转换为 mermaid flowchart
  result = result.replace(/```(?:flow|flowchart)\n([\s\S]*?)```/g, (_match, code: string) => {
    const mermaidCode = flowToMermaid(code.trim())
    const id = `mermaid-${counter}`
    const encoded = encodeURIComponent(mermaidCode)
    return save(`<div class="mermaid-wrapper" data-id="${id}" data-code="${encoded}"></div>`)
  })

  // mindmap 代码块 → 直接传给 mermaid（内容本身已是 mermaid mindmap 语法）
  result = result.replace(/```mindmap\n([\s\S]*?)```/g, (_match, code: string) => {
    const id = `mermaid-${counter}`
    const mermaidCode = code.trim().startsWith('mindmap') ? code.trim() : 'mindmap\n' + code.trim()
    const encoded = encodeURIComponent(mermaidCode)
    return save(`<div class="mermaid-wrapper" data-id="${id}" data-code="${encoded}"></div>`)
  })

  // GeoJSON code blocks
  result = result.replace(/```geojson\n([\s\S]*?)```/g, (_match, json: string) => {
    const id = `geojson-${counter}`
    const encoded = encodeURIComponent(json.trim())
    return save(`<div class="geojson-wrapper" data-geojson-id="${id}" data-geojson="${encoded}"></div>`)
  })

  // TopoJSON code blocks
  result = result.replace(/```topojson\n([\s\S]*?)```/g, (_match, json: string) => {
    const id = `topojson-${counter}`
    const encoded = encodeURIComponent(json.trim())
    return save(`<div class="geojson-wrapper" data-geojson-id="${id}" data-topojson="${encoded}"></div>`)
  })

  // STL code blocks
  result = result.replace(/```stl\n([\s\S]*?)```/g, (_match, stl: string) => {
    const id = `stl-${counter}`
    const encoded = encodeURIComponent(stl.trim())
    return save(`<div class="stl-wrapper" data-stl-id="${id}" data-stl="${encoded}"></div>`)
  })

  // Chart code blocks (印象笔记 chart 语法)
  result = result.replace(/```chart\n([\s\S]*?)```/g, (_match, raw: string) => {
    const id = `chart-${counter}`
    const encoded = encodeURIComponent(raw.trim())
    return save(`<div class="chart-wrapper" data-chart-id="${id}" data-chart="${encoded}"></div>`)
  })

  // Canvas code blocks
  result = result.replace(/```canvas\n([\s\S]*?)```/g, (_match, json: string) => {
    const id = `canvas-${counter}`
    const encoded = encodeURIComponent(json.trim())
    return save(`<div class="canvas-wrapper" data-canvas-id="${id}" data-canvas-data="${encoded}"></div>`)
  })

  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    return save(`<div class="math-block">${renderMath(latex.trim(), true)}</div>`)
  })

  result = result.replace(/\$([^$\n]+?)\$/g, (_match, latex: string) => {
    return save(renderMath(latex, false))
  })

  let html = md.render(result)

  placeholders.forEach((rendered, ph) => {
    html = html.split(ph).join(rendered)
  })

  return html
}

/**
 * 在源 markdown 中查找选中文本的正确位置。
 * 通过 DOM Range 在预览区中的字符偏移来推算源文档中对应的匹配索引。
 */
function findTextIndexInSource(
  src: string,
  text: string,
  container: HTMLElement,
  range: Range,
): number {
  // 计算选中区域在预览容器中的字符偏移
  const preCaretRange = document.createRange()
  preCaretRange.setStart(container, 0)
  preCaretRange.setEnd(range.startContainer, range.startOffset)
  const previewOffset = preCaretRange.toString().length

  // 找到源文档中所有匹配位置
  const matches: number[] = []
  let searchFrom = 0
  while (true) {
    const idx = src.indexOf(text, searchFrom)
    if (idx === -1) break
    matches.push(idx)
    searchFrom = idx + 1
  }

  if (matches.length === 0) return -1
  if (matches.length === 1) return matches[0]

  // 估算源文本中的大致位置（预览 HTML 通常比源文本长一些）
  const ratio = src.length / Math.max(container.textContent?.length ?? 1, 1)
  const estimatedSourcePos = Math.round(previewOffset * ratio)

  // 找最接近估算位置的匹配
  let best = matches[0]
  let bestDist = Math.abs(matches[0] - estimatedSourcePos)
  for (const m of matches.slice(1)) {
    const d = Math.abs(m - estimatedSourcePos)
    if (d < bestDist) {
      bestDist = d
      best = m
    }
  }
  return best
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

interface MarkdownPreviewProps {
  content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleFormat = useCallback((action: string, value?: string) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString()
    if (!text.trim()) return

    const { content: src, setContent } = useEditorStore.getState()
    const container = containerRef.current
    if (!container) return

    // 获取当前 range
    let range: Range
    try {
      range = sel.getRangeAt(0)
    } catch {
      return
    }

    // 智能查找匹配位置
    const idx = findTextIndexInSource(src, text, container, range)
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

  // 提取各类图表块的指纹，仅内容变化时才触发重渲染
  const mermaidFingerprint = useMemo(() => extractBlockFingerprint(content, 'mermaid'), [content])
  const geoFingerprint = useMemo(() =>
    extractBlockFingerprint(content, 'geojson') + '|' + extractBlockFingerprint(content, 'topojson'),
    [content],
  )
  const stlFingerprint = useMemo(() => extractBlockFingerprint(content, 'stl'), [content])
  const chartFingerprint = useMemo(() => extractBlockFingerprint(content, 'chart'), [content])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mermaidFingerprint])

  // 渲染 GeoJSON / TopoJSON 地图
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const mapWrappers = container.querySelectorAll('.geojson-wrapper')
    if (mapWrappers.length === 0) return

    const cleanups: (() => void)[] = []
    const timers: ReturnType<typeof setTimeout>[] = []

    mapWrappers.forEach((wrapper) => {
      const el = wrapper as HTMLElement
      // 先放占位，延迟初始化地图，确保容器有确定尺寸
      const mapDiv = document.createElement('div')
      mapDiv.className = 'geojson-map'
      el.appendChild(mapDiv)

      const timer = setTimeout(() => {
        try {
          const map = L.map(mapDiv, { attributionControl: false }).setView([20, 0], 2)
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
          }).addTo(map)

          let bounds: L.LatLngBounds | null = null
          const topojsonEncoded = el.getAttribute('data-topojson')
          if (topojsonEncoded) {
            const topoData = JSON.parse(decodeURIComponent(topojsonEncoded))
            const geoData = topojsonToGeo(topoData)
            const layer = L.geoJSON(geoData as any).addTo(map)
            bounds = layer.getBounds().isValid() ? layer.getBounds().pad(0.2) : null
          } else {
            const geoEncoded = el.getAttribute('data-geojson')
            if (geoEncoded) {
              const geoData = JSON.parse(decodeURIComponent(geoEncoded))
              const layer = L.geoJSON(geoData).addTo(map)
              bounds = layer.getBounds().isValid() ? layer.getBounds().pad(0.2) : null
            }
          }

          map.invalidateSize()
          if (bounds) map.fitBounds(bounds)

          cleanups.push(() => map.remove())
        } catch (e) {
          el.innerHTML = `<div class="mermaid-error"><em>地图渲染失败: ${e}</em></div>`
        }
      }, 200)
      timers.push(timer)
    })
    return () => {
      timers.forEach((t) => clearTimeout(t))
      cleanups.forEach((fn) => fn())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoFingerprint])

  // 渲染 STL 3D 模型
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const stlWrappers = container.querySelectorAll('.stl-wrapper')
    if (stlWrappers.length === 0) return

    const cleanups: (() => void)[] = []
    stlWrappers.forEach((wrapper) => {
      const el = wrapper as HTMLElement
      const canvas = document.createElement('canvas')
      canvas.className = 'stl-canvas'
      el.appendChild(canvas)

      try {
        const encoded = el.getAttribute('data-stl') || ''
        const stlText = decodeURIComponent(encoded)
        const geometry = parseSTL(stlText)
        geometry.computeVertexNormals()

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(45, 2, 0.1, 1000)
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        renderer.setPixelRatio(window.devicePixelRatio)

        const material = new THREE.MeshPhongMaterial({ color: 0x6b9fc7, flatShading: true })
        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)

        // 灯光
        scene.add(new THREE.AmbientLight(0x606060))
        const directional = new THREE.DirectionalLight(0xffffff, 1)
        directional.position.set(1, 1, 1)
        scene.add(directional)

        // 背景
        const isDark = document.documentElement.classList.contains('dark')
        scene.background = new THREE.Color(isDark ? 0x1e293b : 0xf0f0f0)
        renderer.setSize(el.clientWidth, 400)
        canvas.style.width = '100%'
        canvas.style.height = '400px'

        // 自适应相机 + 网格
        geometry.computeBoundingBox()
        const box = geometry.boundingBox!
        const center = new THREE.Vector3()
        box.getCenter(center)
        const size = new THREE.Vector3()
        box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z)

        // 地面网格 — 根据模型大小自适应
        const gridSize = Math.ceil(maxDim * 4)
        const gridDivisions = 20
        const grid = new THREE.GridHelper(gridSize, gridDivisions,
          isDark ? 0x555555 : 0xaaaaaa,
          isDark ? 0x333333 : 0xdddddd,
        )
        // 网格放在模型底部
        grid.position.y = box.min.y
        scene.add(grid)

        // 坐标轴辅助（短小，放在模型中心底部）
        const axisLength = maxDim * 0.3
        const axisHelper = new THREE.AxesHelper(axisLength)
        axisHelper.position.set(center.x, box.min.y, center.z)
        scene.add(axisHelper)
        camera.position.set(center.x + maxDim, center.y + maxDim, center.z + maxDim)
        camera.lookAt(center)

        // 控制器
        const controls = new OrbitControls(camera, canvas)
        controls.target.copy(center)
        controls.enableDamping = true
        controls.update()

        let animId: number
        const animate = () => {
          animId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        cleanups.push(() => {
          cancelAnimationFrame(animId)
          controls.dispose()
          renderer.dispose()
          geometry.dispose()
          material.dispose()
        })
      } catch (e) {
        el.innerHTML = `<div class="mermaid-error"><em>STL 渲染失败: ${e}</em></div>`
      }
    })
    return () => cleanups.forEach((fn) => fn())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stlFingerprint])

  // 渲染 Chart 图表（印象笔记 chart 语法）
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chartWrappers = container.querySelectorAll('.chart-wrapper')
    if (chartWrappers.length === 0) return

    const instances: Chart[] = []
    chartWrappers.forEach((wrapper) => {
      const el = wrapper as HTMLElement
      const encoded = el.getAttribute('data-chart') || ''
      const raw = decodeURIComponent(encoded)
      const canvas = document.createElement('canvas')
      canvas.className = 'chart-canvas'
      el.appendChild(canvas)

      try {
        const config = parseChartBlock(raw)
        const chart = new Chart(canvas, config)
        instances.push(chart)
      } catch (e) {
        el.innerHTML = `<div class="mermaid-error"><em>图表渲染失败: ${e}</em></div>`
      }
    })
    return () => instances.forEach((c) => c.destroy())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartFingerprint])

  // Mount CanvasBlock components into canvas-wrapper divs
  const canvasRootsRef = useRef<Root[]>([])
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clean up previous roots
    canvasRootsRef.current.forEach((r) => r.unmount())
    canvasRootsRef.current = []

    const wrappers = container.querySelectorAll('.canvas-wrapper')
    if (wrappers.length === 0) return

    wrappers.forEach((wrapper) => {
      const el = wrapper as HTMLElement
      const encoded = el.getAttribute('data-canvas-data') || ''

      let data: CanvasData = { strokes: [] }
      try {
        data = JSON.parse(decodeURIComponent(encoded))
      } catch { /* empty canvas */ }

      const root = createRoot(el)
      canvasRootsRef.current.push(root)
      root.render(
        <CanvasBlock
          data={data}
          onChange={(newData) => {
            // Write back to markdown source
            const { content: src, setContent } = useEditorStore.getState()
            const newJson = JSON.stringify(newData)
            const regex = new RegExp(
              '```canvas\\n' + escapeRegex(decodeURIComponent(encoded)).replace(/\n/g, '\\n') + '\\n```',
            )
            const newSrc = src.replace(regex, `\`\`\`canvas\n${newJson}\n\`\`\``)
            if (newSrc !== src) {
              // Update the encoded data attribute too
              el.setAttribute('data-canvas-data', encodeURIComponent(newJson))
              setContent(newSrc)
            }
          }}
        />,
      )
    })

    return () => {
      canvasRootsRef.current.forEach((r) => r.unmount())
      canvasRootsRef.current = []
    }
  }, [html])

  // 注册滚动同步（直接操作 DOM，不经过 React 状态）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    registerPreview(el)
    return () => unregisterPreview(el)
  }, [])

  // 拦截预览区链接点击，用系统浏览器打开
  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('a')
    if (!target) return
    const href = target.getAttribute('href')
    if (!href) return
    e.preventDefault()
    // 锚点跳转（页内链接）
    if (href.startsWith('#')) {
      const id = href.slice(1)
      const el = containerRef.current?.querySelector(`[id="${id}"], a[name="${id}"]`)
      el?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    // 外部链接用系统浏览器打开
    openUrl(href).catch(console.error)
  }, [])

  return (
    <>
      <div
        ref={containerRef}
        className="prose prose-gray dark:prose-invert max-w-none p-6 h-full overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handlePreviewClick}
      />
      <SelectionToolbar onFormat={handleFormat} />
    </>
  )
}

async function renderMermaid(blocks: NodeListOf<Element>) {
  const m = (window as any).mermaid
  if (!m) return
  const nonce = Date.now()
  let idx = 0
  for (const block of blocks) {
    const code = decodeURIComponent(block.getAttribute('data-code') || '')
    const baseId = block.getAttribute('data-id') || ''
    // 每次渲染用唯一 ID，避免 mermaid 缓存冲突
    const uniqueId = `${baseId}-${nonce}-${idx++}`
    try {
      const { svg } = await m.render(uniqueId, code)
      block.innerHTML = `<div class="mermaid-chart">${svg}</div>`
    } catch (e) {
      block.innerHTML = `<div class="mermaid-error"><em>Mermaid 渲染失败: ${e}</em></div>`
    }
  }
}

/** 将 TopoJSON 正确转换为 GeoJSON */
function topojsonToGeo(topo: any): any {
  const keys = Object.keys(topo.objects || {})
  if (keys.length === 0) return { type: 'FeatureCollection', features: [] }

  const arcs: number[][][] = topo.arcs || []
  const transform = topo.transform
  const scale = transform ? transform.scale : [1, 1]
  const translate = transform ? transform.translate : [0, 0]

  /** 将一个 arc 索引解码为绝对地理坐标点序列 */
  function decodeArc(arcIdx: number): [number, number][] {
    const arc = arcs[arcIdx < 0 ? ~arcIdx : arcIdx]
    const points: [number, number][] = []
    let x = 0, y = 0
    for (const pt of arc) {
      x += pt[0]
      y += pt[1]
      points.push([x * scale[0] + translate[0], y * scale[1] + translate[1]])
    }
    if (arcIdx < 0) points.reverse()
    return points
  }

  /** 将多个 arc 拼接为一条折线，去除连接处的重复点 */
  function stitchArcs(indices: number[]): [number, number][] {
    const result: [number, number][] = []
    for (const idx of indices) {
      const pts = decodeArc(idx)
      if (result.length > 0 && pts.length > 0) {
        // 跳过首点（与上一条 arc 的末尾重合）
        result.push(...pts.slice(1))
      } else {
        result.push(...pts)
      }
    }
    return result
  }

  /** 将 TopoJSON 量化的 Point 坐标转为地理坐标 */
  function transformPoint(coords: number[]): [number, number] {
    return [coords[0] * scale[0] + translate[0], coords[1] * scale[1] + translate[1]]
  }

  function convertGeom(geom: any): any {
    if (!geom) return null
    switch (geom.type) {
      case 'Point':
        return { type: 'Point', coordinates: transformPoint(geom.coordinates) }
      case 'MultiPoint':
        return { type: 'MultiPoint', coordinates: geom.coordinates.map(transformPoint) }
      case 'LineString':
        return { type: 'LineString', coordinates: stitchArcs(geom.arcs) }
      case 'MultiLineString':
        return { type: 'MultiLineString', coordinates: geom.arcs.map(stitchArcs) }
      case 'Polygon':
        return { type: 'Polygon', coordinates: geom.arcs.map(stitchArcs) }
      case 'MultiPolygon':
        return { type: 'MultiPolygon', coordinates: geom.arcs.map((poly: number[][]) => poly.map(stitchArcs)) }
      default:
        return null
    }
  }

  // 遍历所有 objects 中的顶层对象
  const features: any[] = []
  for (const key of keys) {
    const obj = topo.objects[key]
    const geometries = obj.type === 'GeometryCollection' ? obj.geometries : [obj]
    for (const g of geometries) {
      const geometry = convertGeom(g)
      if (geometry) {
        features.push({ type: 'Feature', properties: g.properties || {}, geometry })
      }
    }
  }

  return { type: 'FeatureCollection', features }
}

/** 解析印象笔记 chart 代码块，返回 Chart.js 配置 */
function parseChartBlock(raw: string): { type: string; data: any; options: any } {
  const lines = raw.split('\n')

  // 分离 CSV 数据行和配置项
  const dataLines: string[] = []
  const options: Record<string, string> = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.includes(':') && !trimmed.startsWith(',')) {
      const idx = trimmed.indexOf(':')
      const key = trimmed.substring(0, idx).trim()
      const val = trimmed.substring(idx + 1).trim()
      options[key] = val
    } else {
      dataLines.push(trimmed)
    }
  }

  // 解析 CSV
  const rows = dataLines.map((l) => l.split(',').map((c) => c.trim()))
  if (rows.length < 2) throw new Error('数据不足')

  const header = rows[0]        // ['', '预算', '收入', ...]
  const labels = rows.slice(1).map((r) => r[0]) // ['June', 'July', ...]

  const chartType = options.type || 'column'
  const title = options.title || ''
  const ySuffix = options['y.suffix'] || ''
  const xTitle = options['x.title'] || ''
  const yTitle = options['y.title'] || ''

  // Chart.js type 映射
  const typeMap: Record<string, string> = {
    pie: 'pie',
    line: 'line',
    column: 'bar',     // Chart.js 的 bar 竖向 = column
    bar: 'bar',        // bar 横向
  }
  let jsType = typeMap[chartType] || 'bar'

  // 为每个数据系列创建 dataset
  const colors = [
    'rgba(54, 162, 235, 0.7)',
    'rgba(255, 99, 132, 0.7)',
    'rgba(75, 192, 192, 0.7)',
    'rgba(255, 206, 86, 0.7)',
    'rgba(153, 102, 255, 0.7)',
    'rgba(255, 159, 64, 0.7)',
  ]
  const borderColors = [
    'rgba(54, 162, 235, 1)',
    'rgba(255, 99, 132, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)',
  ]

  const datasets: any[] = []
  if (jsType === 'pie') {
    // 饼图只取第一行数据
    const row = rows[1]
    const data = row.slice(1).map((v) => parseFloat(v) || 0)
    datasets.push({
      data,
      backgroundColor: colors.slice(0, data.length),
      borderColor: borderColors.slice(0, data.length),
      borderWidth: 1,
    })
    // 饼图的 labels 是系列名
    return {
      type: 'pie',
      data: {
        labels: header.slice(1),
        datasets,
      },
      options: {
        responsive: true,
        plugins: {
          title: title ? { display: true, text: title } : undefined,
          tooltip: { callbacks: { label: (ctx: any) => `${ctx.label}: ${ctx.parsed}${ySuffix}` } },
        },
      },
    }
  }

  // 折线 / 柱状 / 条形图
  for (let i = 1; i < header.length; i++) {
    const data = rows.slice(1).map((r) => parseFloat(r[i]) || 0)
    datasets.push({
      label: header[i],
      data,
      backgroundColor: colors[(i - 1) % colors.length],
      borderColor: borderColors[(i - 1) % borderColors.length],
      borderWidth: chartType === 'line' ? 2 : 1,
      fill: chartType === 'line' ? false : undefined,
      tension: chartType === 'line' ? 0.3 : undefined,
    })
  }

  const isHorizontal = chartType === 'bar' // 条形图横向

  return {
    type: jsType,
    data: { labels, datasets },
    options: {
      indexAxis: isHorizontal ? 'y' : 'x',
      responsive: true,
      plugins: {
        title: title ? { display: true, text: title } : undefined,
        tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y ?? ctx.parsed.x}${ySuffix}` } },
      },
      scales: {
        x: {
          title: isHorizontal ? { display: !!yTitle, text: yTitle } : { display: !!xTitle, text: xTitle },
        },
        y: {
          title: isHorizontal ? { display: !!xTitle, text: xTitle } : { display: !!yTitle, text: yTitle },
          ticks: { callback: (val: any) => val + ySuffix },
        },
      },
    },
  }
}

/** 将 js-sequence-diagrams 语法转换为 mermaid sequenceDiagram */
function sequenceToMermaid(code: string): string {
  const lines = code.split('\n')
  const output: string[] = ['sequenceDiagram']
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Title
    if (trimmed.startsWith('Title:')) {
      output.push(`    title ${trimmed.slice(6).trim()}`)
      continue
    }
    // participant / actor
    if (trimmed.startsWith('participant ') || trimmed.startsWith('actor ')) {
      output.push(`    ${trimmed}`)
      continue
    }
    // Note left/right of A: text / Note over A,B: text / Note over A: text
    const noteMatch = trimmed.match(/^Note\s+(left|right)\s+of\s+(.+?):\s*(.+)$/i)
    if (noteMatch) {
      output.push(`    Note ${noteMatch[1]} of ${noteMatch[2]}: ${noteMatch[3]}`)
      continue
    }
    const noteOver = trimmed.match(/^Note\s+over\s+(.+?):\s*(.+)$/i)
    if (noteOver) {
      output.push(`    Note over ${noteOver[1]}: ${noteOver[2]}`)
      continue
    }
    // 箭头转换：先用占位符隔离所有箭头模式，再统一还原为 mermaid 语法
    const arrowLine = trimmed
      .replace(/-->>/g, '%%A1%%')   // js-sequence -->>  → mermaid -->>
      .replace(/->>/g, '%%A2%%')    // js-sequence ->>   → mermaid ->>
      .replace(/-->/g, '%%A3%%')    // js-sequence -->   → mermaid -->>
      .replace(/->/g, '%%A4%%')     // js-sequence ->    → mermaid ->>
      .replace(/%%A1%%/g, '-->>')
      .replace(/%%A2%%/g, '->>')
      .replace(/%%A3%%/g, '-->>')
      .replace(/%%A4%%/g, '->>')
    output.push(`    ${arrowLine}`)
  }
  return output.join('\n')
}

/** 将 flowchart.js 语法转换为 mermaid flowchart */
function flowToMermaid(code: string): string {
  const lines = code.split('\n')
  const nodes: Map<string, { type: string; label: string }> = new Map()
  const connections: string[] = []

  // 节点类型 → mermaid 形状
  const shapeMap: Record<string, [string, string]> = {
    start:        ['([', '])'],
    end:          ['([', '])'],
    operation:    ['[', ']'],
    subroutine:   ['[[', ']]'],
    condition:    ['{', '}'],
    inputoutput:  ['[/', '/]'],
    parallel:     ['{', '}'],
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 节点定义: id=>type: label
    const defMatch = trimmed.match(/^(\w+)=>(\w+):\s*(.+)$/)
    if (defMatch) {
      const [, id, type, label] = defMatch
      nodes.set(id, { type, label })
      continue
    }

    // 连接: id->id2->id3 或 cond(yes)->id
    if (trimmed.includes('->')) {
      // 分段处理连接
      const segments = trimmed.split('->')
      for (let i = 0; i < segments.length - 1; i++) {
        const from = segments[i].trim()
        const to = segments[i + 1].trim()
        // 检查 from 是否带条件: cond(yes) 或 cond(no)
        const condMatch = from.match(/^(\w+)\((\w+)\)$/)
        if (condMatch) {
          connections.push(`    ${condMatch[1]} -->|${condMatch[2]}| ${to}`)
        } else {
          connections.push(`    ${from} --> ${to}`)
        }
      }
    }
  }

  // 构建节点声明
  const nodeLines: string[] = []
  for (const [id, { type, label }] of nodes) {
    const shape = shapeMap[type] || ['[', ']']
    nodeLines.push(`    ${id}${shape[0]}${label}${shape[1]}`)
  }

  return ['flowchart TD', ...nodeLines, ...connections].join('\n')
}

/** 提取 markdown 中指定类型代码块的指纹，内容不变则返回值不变 */
function extractBlockFingerprint(content: string, lang: string): string {
  const re = new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g')
  const blocks: string[] = []
  let m
  while ((m = re.exec(content)) !== null) {
    blocks.push(m[1].trim())
  }
  return blocks.join('\n---\n')
}

/** 解析 ASCII STL 文本为 Three.js BufferGeometry */
function parseSTL(text: string): THREE.BufferGeometry {
  const vertices: number[] = []
  const vertexRegex = /vertex\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)\s+([\d.eE+\-]+)/g

  // 找所有 facet 块
  const facetRegex = /facet\s+normal[\s\S]*?endfacet/g
  let facetMatch
  while ((facetMatch = facetRegex.exec(text)) !== null) {
    const facet = facetMatch[0]
    const verts: [number, number, number][] = []
    let vMatch
    vertexRegex.lastIndex = 0
    while ((vMatch = vertexRegex.exec(facet)) !== null) {
      verts.push([parseFloat(vMatch[1]), parseFloat(vMatch[2]), parseFloat(vMatch[3])])
    }
    // 三角形顶点
    if (verts.length >= 3) {
      for (let i = 0; i < 3; i++) {
        vertices.push(verts[i][0], verts[i][1], verts[i][2])
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  return geometry
}
