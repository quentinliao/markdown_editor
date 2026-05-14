import { useState, useRef, useEffect } from 'react'
import { useLibraryStore } from '../../store/libraryStore'
import { useEditorStore } from '../../store/editorStore'
import { invoke } from '@tauri-apps/api/core'
import { Search, X } from 'lucide-react'

interface SearchPanelProps {
  open: boolean
  onClose: () => void
}

export function SearchPanel({ open, onClose }: SearchPanelProps) {
  const { searchResults, search, searchQuery, setSearchQuery } = useLibraryStore()
  const setContent = useEditorStore((s) => s.setContent)
  const setFilePath = useEditorStore((s) => s.setFilePath)
  const setDirty = useEditorStore((s) => s.setDirty)
  const inputRef = useRef<HTMLInputElement>(null)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  const handleChange = (value: string) => {
    setSearchQuery(value)
    if (debounceTimer) clearTimeout(debounceTimer)
    const timer = setTimeout(() => search(value), 300)
    setDebounceTimer(timer)
  }

  const handleSelect = async (path: string) => {
    try {
      const content = await invoke<string>('read_file', { path })
      setContent(content)
      setFilePath(path)
      setDirty(false)
      onClose()
    } catch {
      // ignore
    }
  }

  if (!open) return null

  return (
    <div className="absolute top-10 right-0 w-96 max-h-[70vh] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col">
      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700">
        <Search size={16} className="text-gray-400 flex-shrink-0" />
        <input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="搜索文档..."
          className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
        />
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
          <X size={14} className="text-gray-400" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1">
        {searchResults.length === 0 && searchQuery && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">未找到匹配文档</div>
        )}
        {searchResults.map((result) => (
          <div
            key={result.id}
            onClick={() => handleSelect(result.path)}
            className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
          >
            <div className="text-sm font-medium truncate">{result.title}</div>
            <div
              className="text-xs text-gray-500 mt-0.5 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: result.snippet }}
            />
            <div className="text-xs text-gray-400 mt-1 truncate">{result.path}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
