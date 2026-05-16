import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Pencil, Check, X } from 'lucide-react'
import { useChatStore, Session } from '../../store/chatStore'

export function SessionSelector() {
  const { getActiveSession, getSessionsForDocument, createSession, switchSession, deleteSession, renameSession } =
    useChatStore()
  const activeSession = getActiveSession()
  const docPath = activeSession?.documentPath ?? ''
  const sessions = getSessionsForDocument(docPath)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [showList, setShowList] = useState(false)

  const handleNew = () => {
    if (!docPath) return
    createSession(docPath)
  }

  const startEdit = (s: Session) => {
    setEditingId(s.id)
    setEditTitle(s.title)
  }

  const confirmEdit = () => {
    if (editingId && editTitle.trim()) {
      renameSession(editingId, editTitle.trim())
    }
    setEditingId(null)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          onClick={() => setShowList(!showList)}
          className="flex-1 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1.5 py-1 truncate"
        >
          <MessageSquare size={12} />
          <span className="truncate">{activeSession?.title ?? '选择对话'}</span>
          <span className="text-gray-400 text-[10px]">({sessions.length})</span>
        </button>
        <button
          onClick={handleNew}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          title="新建对话"
        >
          <Plus size={13} />
        </button>
      </div>

      {showList && (
        <div className="absolute top-full left-0 right-0 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400">暂无对话</div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-1 px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                s.id === activeSession?.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''
              }`}
              onClick={() => {
                if (editingId !== s.id) {
                  switchSession(s.id)
                  setShowList(false)
                }
              }}
            >
              {editingId === s.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    className="flex-1 text-xs border rounded px-1 py-0.5 bg-transparent dark:border-gray-600 focus:outline-none"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button onClick={(e) => { e.stopPropagation(); confirmEdit() }} className="text-green-500">
                    <Check size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingId(null) }} className="text-gray-400">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <MessageSquare size={11} className="flex-shrink-0 opacity-50" />
                  <span className="flex-1 truncate">{s.title}</span>
                  <span className="text-[10px] text-gray-400">{s.messages.length}条</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(s) }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-blue-500"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                    className="p-0.5 hover:text-red-500"
                  >
                    <Trash2 size={10} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
