import { useEffect } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { LibraryTree } from './LibraryTree'
import { FolderPlus, Trash2, ChevronRight, ChevronDown } from 'lucide-react'

export function Sidebar() {
  const { libraries, expandedLibraries, loadLibraries, addLibrary, removeLibrary, toggleLibrary } =
    useLibraryStore()

  useEffect(() => {
    loadLibraries()
  }, [loadLibraries])

  const handleAddLibrary = async () => {
    const name = prompt('文档库名称:')
    if (!name) return
    const path = prompt('文档库路径:')
    if (!path) return
    await addLibrary(name, path)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">文档库</span>
        <button
          onClick={handleAddLibrary}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          title="添加文档库"
        >
          <FolderPlus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {libraries.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-400 text-center">
            点击 + 添加文档库
          </div>
        )}
        {libraries.map((lib) => (
          <div key={lib.id}>
            <div className="flex items-center gap-1 px-2 py-1 group">
              <button
                onClick={() => toggleLibrary(lib.id)}
                className="flex items-center gap-1 flex-1 min-w-0 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5"
              >
                {expandedLibraries.has(lib.id) ? (
                  <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                )}
                <span className="truncate">{lib.name}</span>
              </button>
              <button
                onClick={() => removeLibrary(lib.id)}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700"
                title="移除文档库"
              >
                <Trash2 size={12} className="text-gray-400" />
              </button>
            </div>
            {expandedLibraries.has(lib.id) && <LibraryTree libraryId={lib.id} />}
          </div>
        ))}
      </div>
    </div>
  )
}
