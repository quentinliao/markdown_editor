import { useState } from 'react'
import { Send, Trash2, Settings } from 'lucide-react'
import { useAiStore } from '../../store/aiStore'
import { useEditorStore } from '../../store/editorStore'
import { MessageList } from './MessageList'
import { QuickActions } from './QuickActions'
import { SettingsModal } from './SettingsModal'
import { streamChat } from '../../lib/aiService'

export function AiChatPanel() {
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const { messages, config, isStreaming, addMessage, updateLastMessage, clearMessages, setStreaming } = useAiStore()
  const { content: docContent, setContent } = useEditorStore()

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isStreaming) return
    setInput('')
    addMessage({ role: 'user', content: prompt })
    addMessage({ role: 'assistant', content: '' })
    setStreaming(true)

    try {
      const systemPrompt = `你是一个 Markdown 写作助手。以下是当前文档内容：\n\n${docContent}\n\n请根据用户的指令帮助改进或扩展这篇文档。`
      let accumulated = ''
      await streamChat(config, systemPrompt, [...messages, { id: '', role: 'user' as const, content: prompt, timestamp: 0 }], (chunk) => {
        accumulated += chunk
        updateLastMessage(accumulated)
      })
    } catch (e) {
      updateLastMessage(`错误: ${(e as Error).message}`)
    } finally {
      setStreaming(false)
    }
  }

  const handleInsert = () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant) setContent(docContent + '\n\n' + lastAssistant.content)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500">AI 助手</span>
        <div className="flex gap-1">
          <button onClick={() => setShowSettings(true)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            <Settings size={13} />
          </button>
          <button onClick={clearMessages} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <QuickActions onAction={(p) => sendMessage(p)} />
      <MessageList messages={messages} />
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <div className="flex gap-1">
          <textarea
            className="flex-1 text-xs border rounded p-1.5 resize-none bg-transparent dark:border-gray-600 focus:outline-none"
            rows={3}
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming}
            className="self-end p-2 rounded bg-blue-500 text-white disabled:opacity-50"
          >
            <Send size={13} />
          </button>
        </div>
        <button onClick={handleInsert} className="w-full text-xs py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
          插入到文档
        </button>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
