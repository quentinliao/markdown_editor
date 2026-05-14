import { useState } from 'react'
import { FileNode, useLibraryStore } from '../../store/libraryStore'
import { useEditorStore } from '../../store/editorStore'
import { invoke } from '@tauri-apps/api/core'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from 'lucide-react'

interface LibraryTreeProps {
  libraryId: number
}

export function LibraryTree({ libraryId }: LibraryTreeProps) {
  const fileTrees = useLibraryStore((s) => s.fileTrees)
  const nodes = fileTrees[libraryId] ?? []

  if (nodes.length === 0) {
    return <div className="px-4 py-2 text-xs text-gray-400">空目录</div>
  }

  return (
    <div className="pl-2">
      {nodes.map((node) => (
        <FileTreeNode key={node.path} node={node} libraryId={libraryId} depth={0} />
      ))}
    </div>
  )
}

function FileTreeNode({
  node,
  libraryId,
  depth,
}: {
  node: FileNode
  libraryId: number
  depth: number
}) {
  const [expanded, setExpanded] = useState(false)
  const setContent = useEditorStore((s) => s.setContent)
  const setFilePath = useEditorStore((s) => s.setFilePath)
  const indexDocument = useLibraryStore((s) => s.indexDocument)
  const setDirty = useEditorStore((s) => s.setDirty)

  const handleClick = async () => {
    if (node.is_dir) {
      setExpanded(!expanded)
      return
    }
    try {
      const content = await invoke<string>('read_file', { path: node.path })
      setContent(content)
      setFilePath(node.path)
      setDirty(false)
      indexDocument(libraryId, node.path)
    } catch {
      // ignore read errors
    }
  }

  const Icon = node.is_dir ? (expanded ? FolderOpen : Folder) : FileText
  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-sm"
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleClick}
      >
        {node.is_dir && <Chevron size={12} className="text-gray-400 flex-shrink-0" />}
        {!node.is_dir && <span className="w-3" />}
        <Icon size={14} className={node.is_dir ? 'text-yellow-500' : 'text-gray-500'} />
        <span className="truncate">{node.name}</span>
      </div>
      {expanded && node.is_dir && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              libraryId={libraryId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
