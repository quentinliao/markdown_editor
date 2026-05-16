import { useState, useEffect } from 'react'
import { AppLayout } from './components/Layout/AppLayout'
import { MarkdownEditor } from './components/Editor/MarkdownEditor'
import { MarkdownPreview } from './components/Preview/MarkdownPreview'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SearchPanel } from './components/Search/SearchPanel'
import { useEditorStore } from './store/editorStore'
import { useLibraryStore } from './store/libraryStore'
import { useUIStore } from './store/uiStore'
import { applyThemeColors } from './store/themeStore'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { invoke } from '@tauri-apps/api/core'

function App() {
  const { content, cursorLine, filePath } = useEditorStore()
  const theme = useUIStore((s) => s.theme)
  const [searchOpen, setSearchOpen] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // 启动时恢复上次打开的文件
  useEffect(() => {
    useEditorStore.getState().restoreLastFile()
  }, [])

  // 每 5 秒自动保存
  useEffect(() => {
    const timer = setInterval(() => {
      useEditorStore.getState().autoSave()
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // 应用主题到 document + 颜色变量
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
    applyThemeColors(isDark)
  }, [theme])

  // 监听 Tauri 原生拖拽事件
  useEffect(() => {
    const webview = getCurrentWebview()

    const unlisten = webview.onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDragOver(true)
      } else if (event.payload.type === 'leave') {
        setIsDragOver(false)
      } else if (event.payload.type === 'drop') {
        setIsDragOver(false)
        const paths = event.payload.paths
        if (!paths.length) return

        // 找到第一个 .md / .markdown / .txt 文件
        const mdPath = paths.find((p: string) => {
          const lower = p.toLowerCase()
          return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')
        })
        if (!mdPath) return

        // 通过 Tauri 后端读取文件内容并打开
        invoke<string>('read_file', { path: mdPath })
          .then(async (fileContent) => {
            useEditorStore.getState().openFile(mdPath, fileContent)

            // 将文件所在目录添加为文档库（已存在则跳过）
            const dir = mdPath.substring(0, mdPath.lastIndexOf('/'))
            const libName = dir.split('/').pop() || '文档库'
            try {
              const lib = await useLibraryStore.getState().ensureLibrary(libName, dir)
              // 展开该库并定位到文件
              const { expandedLibraries, toggleLibrary, loadFileTree, fileTrees, setLocateTargetPath } = useLibraryStore.getState()
              if (!expandedLibraries.has(lib.id)) {
                toggleLibrary(lib.id)
              } else if (!fileTrees[lib.id]) {
                loadFileTree(lib.id, lib.path)
              }
              setLocateTargetPath(mdPath)
              setTimeout(() => setLocateTargetPath(null), 1000)
            } catch {
              // 添加文档库失败不影响打开文件
            }
          })
          .catch(() => {
            // ignore read errors
          })
      }
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  return (
    <div className="relative h-screen">
      <AppLayout
        sidebar={<Sidebar />}
        toolbarProps={{ onSearchToggle: () => setSearchOpen(!searchOpen) }}
        editor={<MarkdownEditor />}
        preview={<MarkdownPreview content={content} />}
        statusProps={{
          wordCount: content.length,
          lineCount: cursorLine,
          filePath: filePath ?? undefined,
        }}
      />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* 拖拽覆盖层 */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 border-2 border-dashed border-blue-400 pointer-events-none">
          <div className="px-6 py-4 rounded-xl bg-white/90 dark:bg-gray-800/90 shadow-xl">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">释放以打开 Markdown 文件</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
