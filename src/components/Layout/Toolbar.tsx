import { FileText, Search, Download, Columns2 } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

export function Toolbar() {
  const { viewMode, setViewMode } = useUIStore()
  return (
    <div className="h-10 flex items-center gap-2 px-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
      <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="新建文档">
        <FileText size={16} />
      </button>
      <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="搜索">
        <Search size={16} />
      </button>
      <div className="flex-1" />
      <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="导出">
        <Download size={16} />
      </button>
      <button
        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        title="切换视图"
        onClick={() => setViewMode(viewMode === 'full' ? 'editor-only' : 'full')}
      >
        <Columns2 size={16} />
      </button>
    </div>
  )
}
