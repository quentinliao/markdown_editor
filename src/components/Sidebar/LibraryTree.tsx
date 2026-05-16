import { useState, useCallback, useRef, useEffect } from 'react'
import { FileNode, useLibraryStore } from '../../store/libraryStore'
import { useEditorStore } from '../../store/editorStore'
import { invoke } from '@tauri-apps/api/core'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from 'lucide-react'
import { fileOps } from '../../lib/tauri'

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

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  node: FileNode | null
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, node: null,
  })
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null)
  const [newName, setNewName] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  const openFile = useEditorStore((s) => s.openFile)
  const filePath = useEditorStore((s) => s.filePath)
  const indexDocument = useLibraryStore((s) => s.indexDocument)
  const refreshFileTree = useLibraryStore((s) => s.refreshFileTree)
  const locateTargetPath = useLibraryStore((s) => s.locateTargetPath)

  const isActive = filePath === node.path

  // 响应定位目标：如果是祖先目录则展开，如果是目标文件则滚动到可视区
  useEffect(() => {
    if (!locateTargetPath) return
    // 判断当前节点是否为目标路径的祖先（目标路径以 node.path/ 开头）
    // 或者当前节点就是目标文件
    const isAncestor = locateTargetPath.startsWith(node.path + '/')
    const isTarget = locateTargetPath === node.path
    if (isAncestor && node.is_dir) {
      setExpanded(true)
    }
    if (isTarget && rowRef.current) {
      // 稍微延迟让 DOM 展开完成后再滚动
      requestAnimationFrame(() => {
        rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    }
  }, [locateTargetPath, node.path, node.is_dir])

  // 点击外部关闭右键菜单
  useEffect(() => {
    if (!contextMenu.visible) return
    const handler = () => setContextMenu((c) => ({ ...c, visible: false }))
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [contextMenu.visible])

  const handleClick = async () => {
    if (renaming || creating) return
    if (node.is_dir) {
      setExpanded(!expanded)
      return
    }
    try {
      const content = await invoke<string>('read_file', { path: node.path })
      openFile(node.path, content)
      indexDocument(libraryId, node.path)
    } catch {
      // ignore read errors
    }
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, node })
  }, [node])

  // 右键菜单操作
  const handleDelete = async () => {
    if (!confirm(`确定删除 "${node.name}" 吗？`)) return
    try {
      await fileOps.deletePath(node.path)
      // 如果删除的是当前打开的文件，清空编辑器
      if (filePath === node.path) {
        useEditorStore.getState().newFile()
      }
      refreshFileTree(libraryId)
    } catch (e) {
      alert(`删除失败: ${e}`)
    }
  }

  const startRename = () => {
    setRenameValue(node.name)
    setRenaming(true)
  }

  const confirmRename = async () => {
    if (!renameValue.trim() || renameValue === node.name) {
      setRenaming(false)
      return
    }
    const dir = node.path.substring(0, node.path.lastIndexOf('/'))
    const newPath = `${dir}/${renameValue.trim()}`
    try {
      await fileOps.renameFile(node.path, newPath)
      // 如果重命名的是当前打开的文件，更新路径
      if (filePath === node.path) {
        const content = useEditorStore.getState().content
        openFile(newPath, content)
      }
      refreshFileTree(libraryId)
    } catch (e) {
      alert(`重命名失败: ${e}`)
    }
    setRenaming(false)
  }

  const startCreate = (type: 'file' | 'folder') => {
    setCreating(type)
    setNewName(type === 'file' ? 'untitled.md' : 'new-folder')
  }

  const confirmCreate = async () => {
    if (!newName.trim()) {
      setCreating(null)
      return
    }
    const newPath = `${node.path}/${newName.trim()}`
    try {
      if (creating === 'file') {
        await fileOps.createFile(newPath)
      } else {
        await fileOps.createDirectory(newPath)
      }
      refreshFileTree(libraryId)
      if (node.is_dir) setExpanded(true)
    } catch (e) {
      alert(`创建失败: ${e}`)
    }
    setCreating(null)
  }

  const Icon = node.is_dir ? (expanded ? FolderOpen : Folder) : FileText
  const Chevron = expanded ? ChevronDown : ChevronRight

  return (
    <div>
      {/* 文件/目录行 */}
      <div
        ref={rowRef}
        className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer rounded text-sm ${
          isActive
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {node.is_dir && <Chevron size={12} className="text-gray-400 flex-shrink-0" />}
        {!node.is_dir && <span className="w-3" />}
        <Icon size={14} className={node.is_dir ? 'text-yellow-500 flex-shrink-0' : 'text-gray-500 flex-shrink-0'} />
        {renaming ? (
          <input
            autoFocus
            className="flex-1 min-w-0 text-sm bg-white dark:bg-gray-800 border border-blue-400 rounded px-1 outline-none"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={confirmRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>

      {/* 新建文件/文件夹输入框 */}
      {creating && (
        <div
          className="flex items-center gap-1 px-2 py-0.5"
          style={{ paddingLeft: (depth + 1) * 12 + 8 }}
        >
          {creating === 'file' ? <FileText size={14} className="text-gray-500 flex-shrink-0" /> : <Folder size={14} className="text-yellow-500 flex-shrink-0" />}
          <input
            autoFocus
            className="flex-1 min-w-0 text-sm bg-white dark:bg-gray-800 border border-blue-400 rounded px-1 outline-none"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={confirmCreate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmCreate()
              if (e.key === 'Escape') setCreating(null)
            }}
          />
        </div>
      )}

      {/* 子节点 */}
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

      {/* 右键菜单 */}
      {contextMenu.visible && contextMenu.node?.path === node.path && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {node.is_dir && (
            <>
              <ContextMenuItem label="新建文件" shortcut="md" onClick={() => { setContextMenu((c) => ({ ...c, visible: false })); startCreate('file') }} />
              <ContextMenuItem label="新建文件夹" onClick={() => { setContextMenu((c) => ({ ...c, visible: false })); startCreate('folder') }} />
              <div className="my-1 border-t border-gray-200 dark:border-gray-600" />
            </>
          )}
          <ContextMenuItem label="重命名" onClick={() => { setContextMenu((c) => ({ ...c, visible: false })); startRename() }} />
          <ContextMenuItem label="删除" danger onClick={() => { setContextMenu((c) => ({ ...c, visible: false })); handleDelete() }} />
        </div>
      )}
    </div>
  )
}

function ContextMenuItem({ label, shortcut, danger, onClick }: {
  label: string
  shortcut?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
        danger ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'
      }`}
    >
      <span>{label}</span>
      {shortcut && <span className="text-gray-400 ml-4">{shortcut}</span>}
    </button>
  )
}
