import { useState, useRef, useEffect, useCallback } from 'react'
import { FileText, X, File, Search } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { FileNode } from '../../store/libraryStore'
import { MessageAttachment } from '../../store/chatStore'

interface FileReferenceProps {
  attachments: MessageAttachment[]
  onAttach: (attachment: MessageAttachment) => void
  onRemove: (path: string) => void
  currentDocContent: string
  currentDocPath: string | null
}

export function FileReference({
  attachments,
  onAttach,
  onRemove,
  currentDocContent,
  currentDocPath,
}: FileReferenceProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)

  const loadFiles = useCallback(async () => {
    try {
      if (currentDocPath) {
        const dir = currentDocPath.substring(0, currentDocPath.lastIndexOf('/'))
        const nodes = await invoke<FileNode[]>('read_directory', { path: dir })
        setFileTree(nodes)
      }
    } catch {
      // ignore — file tree loading is optional
    }
  }, [currentDocPath])

  useEffect(() => {
    if (showPicker) loadFiles()
  }, [showPicker, loadFiles])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    if (showPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPicker])

  const attachCurrentDoc = () => {
    if (!currentDocPath) return
    onAttach({
      type: 'document',
      path: currentDocPath,
      content: currentDocContent,
      name: currentDocPath.split('/').pop() ?? '当前文档',
    })
  }

  const attachFile = async (node: FileNode) => {
    if (node.is_dir) return
    try {
      const content = await invoke<string>('read_file', { path: node.path })
      onAttach({
        type: 'file',
        path: node.path,
        content,
        name: node.name,
      })
    } catch {
      // ignore read errors
    }
    setShowPicker(false)
  }

  const filteredFiles = searchQuery
    ? fileTree.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : fileTree

  return (
    <div ref={pickerRef} className="relative">
      {/* Attachment tags */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1">
          {attachments.map((att) => (
            <span
              key={att.path}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            >
              <FileText size={10} />
              {att.name}
              <button onClick={() => onRemove(att.path)} className="hover:text-red-500">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* File picker popup */}
      {showPicker && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-48 overflow-hidden">
          <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-200 dark:border-gray-600">
            <Search size={11} className="text-gray-400" />
            <input
              className="flex-1 text-xs bg-transparent focus:outline-none"
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-36">
            {/* Current document option */}
            {currentDocPath && (
              <button
                onClick={attachCurrentDoc}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
              >
                <FileText size={12} className="text-blue-500" />
                <span className="truncate">📄 当前文档</span>
              </button>
            )}
            {/* File list */}
            {filteredFiles.map((f) => (
              <button
                key={f.path}
                onClick={() => attachFile(f)}
                disabled={f.is_dir}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-left disabled:opacity-50"
              >
                {f.is_dir ? (
                  <span className="text-yellow-500">📁</span>
                ) : (
                  <File size={12} className="text-gray-400" />
                )}
                <span className="truncate">{f.name}</span>
              </button>
            ))}
            {filteredFiles.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">无匹配文件</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Detects `@` trigger at the end of text and returns its position.
 * Returns null if no trigger is active.
 */
export function detectFileTrigger(text: string, cursorPos: number): boolean {
  if (cursorPos === 0) return false
  return text[cursorPos - 1] === '@' && (cursorPos === 1 || /[\s\n]/.test(text[cursorPos - 2]))
}
