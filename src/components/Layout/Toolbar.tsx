import { useState, useEffect } from 'react'
import {
  FileText, Search, Eye, Info, Share, Moon, Sun, Monitor,
  ChevronDown, Table, Image, FileCode, Copy, Printer,
  Bold, Italic, Code, Link, List, ListOrdered, Quote, Strikethrough,
  Heading1, Heading2, Heading3, Heading4, PenTool, FolderOpen, Save
} from 'lucide-react'
import { useUIStore, ViewMode } from '../../store/uiStore'
import { useEditorStore } from '../../store/editorStore'
import { useLibraryStore } from '../../store/libraryStore'
import { ToolbarDropdown, DropdownItem, DropdownSeparator } from './ToolbarDropdown'
import { TableEditorDialog } from './TableEditorDialog'
import { open, save } from '@tauri-apps/plugin-dialog'
import { fileOps } from '../../lib/tauri'
import { invoke } from '@tauri-apps/api/core'
import { Image as TauriImage } from '@tauri-apps/api/image'
import { writeImage as clipboardWriteImage } from '@tauri-apps/plugin-clipboard-manager'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: true })

const VIEW_MODES: { mode: ViewMode; label: string; shortcut: string }[] = [
  // { mode: 'full', label: '分栏（编辑器 + AI + 预览）', shortcut: '' }, // TODO: AI 功能完善后恢复
  { mode: 'no-ai', label: '分栏（编辑器 + 预览）', shortcut: '' },
  { mode: 'editor-only', label: '仅编辑器', shortcut: '' },
  { mode: 'preview-only', label: '仅预览', shortcut: '⌘R' },
]

// 快速编辑操作：在当前光标位置插入/包裹 Markdown 语法
function insertFormat(prefix: string, suffix: string = '', placeholder: string = '') {
  const { content, setContent } = useEditorStore.getState()
  const insert = placeholder || `${prefix}文本${suffix}`
  setContent(content + '\n' + insert)
}

function insertAtLineStart(prefix: string) {
  const { content, setContent } = useEditorStore.getState()
  setContent(content + '\n' + prefix + ' ')
}

interface ToolbarProps {
  onSearchToggle?: () => void
}

export function Toolbar({ onSearchToggle }: ToolbarProps) {
  const { viewMode, setViewMode, theme, setTheme } = useUIStore()
  const { content, filePath, isDirty } = useEditorStore()
  const [tableEditorOpen, setTableEditorOpen] = useState(false)

  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // 新建文档
  const handleNewFile = () => {
    useEditorStore.getState().newFile()
  }

  // 打开文件
  const handleOpenFile = async () => {
    try {
      const selected = await open({
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
        multiple: false,
      })
      if (!selected) return
      const path = selected as string
      const fileContent = await invoke<string>('read_file', { path })
      useEditorStore.getState().openFile(path, fileContent)

      // 将文件所在目录添加为文档库（已存在则跳过）
      const dir = path.substring(0, path.lastIndexOf('/'))
      const libName = dir.split('/').pop() || '文档库'
      try {
        const lib = await useLibraryStore.getState().ensureLibrary(libName, dir)
        const { expandedLibraries, toggleLibrary, loadFileTree, fileTrees, setLocateTargetPath } = useLibraryStore.getState()
        if (!expandedLibraries.has(lib.id)) {
          toggleLibrary(lib.id)
        } else if (!fileTrees[lib.id]) {
          loadFileTree(lib.id, lib.path)
        }
        setLocateTargetPath(path)
        setTimeout(() => setLocateTargetPath(null), 1000)
      } catch {
        // 添加文档库失败不影响打开文件
      }
    } catch {
      // user cancelled or error
    }
  }

  // 保存
  const handleSave = async () => {
    const state = useEditorStore.getState()
    if (state.filePath) {
      await state.save()
    } else {
      // 无文件路径 → 另存为
      try {
        const path = await save({
          filters: [{ name: 'Markdown', extensions: ['md'] }],
          defaultPath: 'untitled.md',
        })
        if (path) await state.saveAs(path)
      } catch {
        // cancelled
      }
    }
  }

  // ⌘S / Ctrl+S 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  // 从文档内容提取第一个标题作为导出文件名
  const getExportName = (ext: string): string => {
    const titleMatch = content.match(/^#{1,6}\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].trim().replace(/[/\\?%*:|"<>]/g, '') : null
    const base = title || (filePath ? filePath.split('/').pop()!.replace(/\.md$/i, '') : 'untitled')
    return `${base}.${ext}`
  }

  // 创建离屏渲染容器（导出图片/复制图片共用）
  const createOffscreenContainer = (): HTMLDivElement => {
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:800px;padding:40px;background:white;font-family:system-ui,sans-serif;line-height:1.6;color:#24292e;'
    container.innerHTML = md.render(content)
    document.body.appendChild(container)
    return container
  }

  const handleExportHtml = async () => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>导出文档</title>
<style>body{max-width:800px;margin:0 auto;padding:40px;font-family:system-ui,sans-serif;line-height:1.6}
pre{background:#f6f8fa;border-radius:6px;padding:16px;overflow-x:auto}
code{font-family:monospace;font-size:0.875em}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d7de;padding:6px 13px}
img{max-width:100%}</style></head><body>${md.render(content)}</body></html>`
    const defaultName = getExportName('html')
    const path = await save({ filters: [{ name: 'HTML', extensions: ['html' ] }], defaultPath: defaultName })
    if (path) await fileOps.writeFile(path, html)
  }

  // 导出为图片文件
  const handleExportImage = async (format: 'png' | 'jpeg') => {
    const { toBlob } = await import('html-to-image')
    const container = createOffscreenContainer()

    try {
      const blob = await toBlob(container, {
        quality: format === 'jpeg' ? 0.92 : undefined,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      if (!blob) return

      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })

      const ext = format === 'jpeg' ? 'jpg' : 'png'
      const path = await save({
        filters: [{ name: format.toUpperCase(), extensions: [ext] }],
        defaultPath: getExportName(ext),
      })
      if (path) await fileOps.saveImage(path, base64)
    } finally {
      document.body.removeChild(container)
    }
  }

  // 复制为图片到剪贴板（通过 Tauri clipboard 插件 + Image.fromBytes 解码 PNG）
  const handleCopyImage = async () => {
    const { toBlob } = await import('html-to-image')
    const container = createOffscreenContainer()

    try {
      const blob = await toBlob(container, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        type: 'image/png',
      })
      if (!blob) return

      const pngBytes = new Uint8Array(await blob.arrayBuffer())
      const image = await TauriImage.fromBytes(pngBytes)
      await clipboardWriteImage(image)
    } finally {
      document.body.removeChild(container)
    }
  }

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(content)
  }

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(md.render(content))
  }

  const handleInsertTable = (markdown: string) => {
    useEditorStore.getState().setContent(content + markdown)
  }

  const wordCount = content.replace(/\s/g, '').length
  const lineCount = content.split('\n').length
  const charCount = content.length

  return (
    <div className="h-10 flex items-center gap-1 px-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
      {/* 左侧：文件操作 */}
      <button onClick={handleNewFile} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="新建文档 (⌘N)">
        <FileText size={16} />
      </button>
      <button onClick={handleOpenFile} className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="打开文件 (⌘O)">
        <FolderOpen size={16} />
      </button>
      <button onClick={handleSave} className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isDirty ? 'text-blue-500' : ''}`} title="保存 (⌘S)">
        <Save size={16} />
      </button>
      <button
        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        title="搜索"
        onClick={onSearchToggle}
      >
        <Search size={16} />
      </button>

      <div className="flex-1" />

      {/* 右侧：编辑操作 */}
      {/* 视图切换 */}
      <ToolbarDropdown
        trigger={
          <button className="flex items-center gap-0.5 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="切换视图">
            <Eye size={16} />
            <ChevronDown size={10} />
          </button>
        }
      >
        {VIEW_MODES.map((v) => (
          <DropdownItem key={v.mode} checked={viewMode === v.mode} shortcut={v.shortcut} onClick={() => setViewMode(v.mode)}>
            {v.label}
          </DropdownItem>
        ))}
      </ToolbarDropdown>

      {/* Aa 快速编辑 */}
      <ToolbarDropdown
        trigger={
          <button className="flex items-center gap-0.5 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium" title="快速编辑">
            Aa
            <ChevronDown size={10} />
          </button>
        }
      >
        {/* 标题 */}
        <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">标题</div>
        <DropdownItem onClick={() => insertAtLineStart('#')}>
          <span className="flex items-center gap-2"><Heading1 size={14} /> 一级标题</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertAtLineStart('##')}>
          <span className="flex items-center gap-2"><Heading2 size={14} /> 二级标题</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertAtLineStart('###')}>
          <span className="flex items-center gap-2"><Heading3 size={14} /> 三级标题</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertAtLineStart('####')}>
          <span className="flex items-center gap-2"><Heading4 size={14} /> 四级标题</span>
        </DropdownItem>
        <DropdownSeparator />
        {/* 文字样式 */}
        <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">文字样式</div>
        <DropdownItem onClick={() => insertFormat('**', '**')}>
          <span className="flex items-center gap-2"><Bold size={14} /> 加粗</span>
          <span className="text-xs text-gray-400 ml-auto">⌘B</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertFormat('*', '*')}>
          <span className="flex items-center gap-2"><Italic size={14} /> 斜体</span>
          <span className="text-xs text-gray-400 ml-auto">⌘I</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertFormat('~~', '~~')}>
          <span className="flex items-center gap-2"><Strikethrough size={14} /> 删除线</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertFormat('`', '`')}>
          <span className="flex items-center gap-2"><Code size={14} /> 行内代码</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertAtLineStart('>')}>
          <span className="flex items-center gap-2"><Quote size={14} /> 引用</span>
        </DropdownItem>
        <DropdownSeparator />
        {/* 列表 */}
        <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">列表</div>
        <DropdownItem onClick={() => insertAtLineStart('-')}>
          <span className="flex items-center gap-2"><List size={14} /> 无序列表</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertAtLineStart('1.')}>
          <span className="flex items-center gap-2"><ListOrdered size={14} /> 有序列表</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertAtLineStart('- [ ]')}>
          <span className="flex items-center gap-2">☐ 任务列表</span>
        </DropdownItem>
        <DropdownSeparator />
        {/* 插入 */}
        <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">插入</div>
        <DropdownItem onClick={() => insertFormat('[', '](url)', '[链接文字](url)')}>
          <span className="flex items-center gap-2"><Link size={14} /> 链接</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertFormat('![', '](url)', '![图片描述](url)')}>
          <span className="flex items-center gap-2"><Image size={14} /> 图片</span>
        </DropdownItem>
        <DropdownItem onClick={() => insertFormat('```\n', '\n```', '```\n代码\n```')}>
          <span className="flex items-center gap-2"><Code size={14} /> 代码块</span>
        </DropdownItem>
        <DropdownItem onClick={() => setTableEditorOpen(true)}>
          <span className="flex items-center gap-2"><Table size={14} /> 表格</span>
        </DropdownItem>
        <DropdownItem onClick={() => { const { content, setContent } = useEditorStore.getState(); setContent(content + '\n---\n') }}>
          <span className="flex items-center gap-2">— 分割线</span>
        </DropdownItem>
        <DropdownItem onClick={() => {
          const { content, setContent } = useEditorStore.getState()
          setContent(content + '\n\n```canvas\n{"strokes":[]}\n```\n')
        }}>
          <span className="flex items-center gap-2"><PenTool size={14} /> 画布</span>
        </DropdownItem>
      </ToolbarDropdown>

      {/* 文档信息 */}
      <ToolbarDropdown
        trigger={
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="文档信息">
            <Info size={16} />
          </button>
        }
      >
        <div className="px-3 py-2 text-xs space-y-1 text-gray-600 dark:text-gray-400">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5">文档信息</div>
          <div className="flex justify-between"><span>字符数</span><span>{charCount}</span></div>
          <div className="flex justify-between"><span>字数</span><span>{wordCount}</span></div>
          <div className="flex justify-between"><span>行数</span><span>{lineCount}</span></div>
          <div className="flex justify-between"><span>状态</span><span>{isDirty ? '已修改' : '已保存'}</span></div>
          {filePath && <div className="pt-1 break-all text-gray-400">{filePath}</div>}
        </div>
      </ToolbarDropdown>

      {/* 导出 */}
      <ToolbarDropdown
        trigger={
          <button className="flex items-center gap-0.5 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="导出">
            <Share size={16} />
            <ChevronDown size={10} />
          </button>
        }
      >
        <DropdownItem onClick={handleExportHtml}>
          <span className="flex items-center gap-2"><FileCode size={14} /> 导出 HTML</span>
        </DropdownItem>
        <DropdownItem onClick={() => handleExportImage('png')}>
          <span className="flex items-center gap-2"><Image size={14} /> 导出 PNG</span>
        </DropdownItem>
        <DropdownItem onClick={() => handleExportImage('jpeg')}>
          <span className="flex items-center gap-2"><Image size={14} /> 导出 JPEG</span>
        </DropdownItem>
        <DropdownItem onClick={() => window.print()}>
          <span className="flex items-center gap-2"><Printer size={14} /> 打印 / PDF</span>
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onClick={handleCopyMarkdown}>
          <span className="flex items-center gap-2"><Copy size={14} /> 复制 Markdown</span>
        </DropdownItem>
        <DropdownItem onClick={handleCopyHtml}>
          <span className="flex items-center gap-2"><Copy size={14} /> 复制 HTML</span>
        </DropdownItem>
        <DropdownItem onClick={handleCopyImage}>
          <span className="flex items-center gap-2"><Copy size={14} /> 复制为图片</span>
        </DropdownItem>
      </ToolbarDropdown>

      {/* 主题切换 */}
      <ToolbarDropdown
        trigger={
          <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="切换主题">
            {resolvedTheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        }
      >
        <DropdownItem checked={theme === 'light'} onClick={() => setTheme('light')}>
          <span className="flex items-center gap-2"><Sun size={14} /> 浅色</span>
        </DropdownItem>
        <DropdownItem checked={theme === 'dark'} onClick={() => setTheme('dark')}>
          <span className="flex items-center gap-2"><Moon size={14} /> 深色</span>
        </DropdownItem>
        <DropdownItem checked={theme === 'system'} onClick={() => setTheme('system')}>
          <span className="flex items-center gap-2"><Monitor size={14} /> 跟随系统</span>
        </DropdownItem>
      </ToolbarDropdown>

      <TableEditorDialog open={tableEditorOpen} onClose={() => setTableEditorOpen(false)} onInsert={handleInsertTable} />
    </div>
  )
}
