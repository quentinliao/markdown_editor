import { useEffect, useRef, useState } from 'react'
import { FileText, Replace, FilePlus, ArrowDownToLine, ChevronDown } from 'lucide-react'
import { Message } from '../../store/chatStore'

interface MessageListProps {
  messages: Message[]
  onApplyToDoc: (content: string) => void
  onAppendToDoc: (content: string) => void
  onNewFile: (content: string) => void
}

export function MessageList({ messages, onApplyToDoc, onAppendToDoc, onNewFile }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[95%] ${msg.role === 'user' ? '' : ''}`}>
            <div
              className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : msg.role === 'system'
                    ? 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs italic'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {msg.attachments.map((att) => (
                    <span
                      key={att.path}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded ${
                        msg.role === 'user'
                          ? 'bg-blue-400/30 text-blue-100'
                          : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <FileText size={9} />
                      {att.name}
                    </span>
                  ))}
                </div>
              )}
              {/* Content */}
              {msg.content || (
                <span className="text-gray-400">
                  {'...'}
                  <span className="animate-pulse">▌</span>
                </span>
              )}
            </div>

            {/* Action buttons for assistant messages with content */}
            {msg.role === 'assistant' && msg.content && msg.content.length > 20 && (
              <AssistantActions
                content={msg.content}
                onApplyToDoc={onApplyToDoc}
                onAppendToDoc={onAppendToDoc}
                onNewFile={onNewFile}
              />
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function AssistantActions({
  content,
  onApplyToDoc,
  onAppendToDoc,
  onNewFile,
}: {
  content: string
  onApplyToDoc: (content: string) => void
  onAppendToDoc: (content: string) => void
  onNewFile: (content: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-1 mt-1">
      <button
        onClick={() => onAppendToDoc(content)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        title="追加到当前文档末尾"
      >
        <ArrowDownToLine size={10} />
        追加到文档
      </button>
      <button
        onClick={() => onApplyToDoc(content)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        title="用 AI 输出替换当前文档全部内容"
      >
        <Replace size={10} />
        替换文档
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400"
        >
          <ChevronDown size={10} />
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-0.5 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg py-0.5">
            <button
              onClick={() => { onNewFile(content); setOpen(false) }}
              className="flex items-center gap-1.5 w-full px-2 py-1 text-[10px] text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              <FilePlus size={10} />
              新建文件
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
