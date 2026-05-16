import { ReactNode, useCallback } from 'react'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { ResizeHandle } from './ResizeHandle'
import { useUIStore } from '../../store/uiStore'
import { Crosshair } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { useLibraryStore } from '../../store/libraryStore'

interface AppLayoutProps {
  sidebar: ReactNode
  editor: ReactNode
  preview: ReactNode
  toolbarProps?: { onSearchToggle?: () => void }
  statusProps: { wordCount: number; lineCount: number; filePath?: string }
}

const MIN_SIDEBAR = 120
const MAX_SIDEBAR = 500

export function AppLayout({ sidebar, editor, preview, toolbarProps, statusProps }: AppLayoutProps) {
  const viewMode = useUIStore((s) => s.viewMode)
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)

  const showPreview = viewMode === 'full' || viewMode === 'no-ai' || viewMode === 'preview-only'
  const showEditor = viewMode !== 'preview-only'

  const handleSidebarResize = useCallback((dx: number) => {
    const w = useUIStore.getState().sidebarWidth + dx
    useUIStore.getState().setSidebarWidth(Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, w)))
  }, [])

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Toolbar {...toolbarProps} />
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* 文档库 */}
        <div
          style={{ width: sidebarWidth }}
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto"
        >
          {sidebar}
        </div>
        <ResizeHandle onResize={handleSidebarResize} />

        {/* 编辑器 */}
        {showEditor && (
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {/* 文件路径栏 */}
            <FilePathBar filePath={statusProps.filePath} />
            <div className="flex-1 min-h-0">
              {editor}
            </div>
          </div>
        )}

        {/* 预览 */}
        {showPreview && (
          <div className="flex-1 min-w-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            {preview}
          </div>
        )}
      </div>
      <StatusBar {...statusProps} />
    </div>
  )
}

function FilePathBar({ filePath }: { filePath?: string }) {
  const name = filePath ? filePath.split('/').pop() : '未命名'
  const isDirty = useEditorStore((s) => s.isDirty)
  const hasFilePath = !!filePath

  /** 点击靶心：展开侧边栏中包含该文件的文档库并高亮文件 */
  const handleLocate = useCallback(() => {
    if (!filePath) return
    const { libraries, fileTrees, toggleLibrary, loadFileTree, setLocateTargetPath } = useLibraryStore.getState()
    // 找到包含该文件的库
    for (const lib of libraries) {
      if (filePath.startsWith(lib.path)) {
        // 确保该库已展开
        const { expandedLibraries } = useLibraryStore.getState()
        if (!expandedLibraries.has(lib.id)) {
          toggleLibrary(lib.id)
        } else if (!fileTrees[lib.id]) {
          loadFileTree(lib.id, lib.path)
        }
        // 设置定位目标，触发 FileTreeNode 展开祖先链 + 滚动到目标
        setLocateTargetPath(filePath)
        // 延迟清除定位目标，避免后续渲染重复触发
        setTimeout(() => setLocateTargetPath(null), 1000)
        break
      }
    }
  }, [filePath])

  return (
    <div className="flex items-center h-6 px-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 gap-1">
      {/* 靶心定位按钮 */}
      {hasFilePath ? (
        <button
          onClick={handleLocate}
          className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 flex-shrink-0 text-blue-500 dark:text-blue-400"
          title="在文档库中定位"
        >
          <Crosshair size={13} />
        </button>
      ) : (
        <span className="w-[18px] flex-shrink-0" />
      )}
      <span className="truncate">{name}</span>
      {filePath && (
        <span className="ml-1 truncate text-gray-400 dark:text-gray-500 hidden sm:inline" style={{ fontSize: '10px' }}>
          {filePath}
        </span>
      )}
      <div className="flex-1" />
      {/* 未保存标记 */}
      {isDirty && (
        <span className="text-amber-500 dark:text-amber-400 font-bold flex-shrink-0 mr-1" title="未保存">*</span>
      )}
    </div>
  )
}
