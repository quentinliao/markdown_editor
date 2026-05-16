import { useState, useEffect, useCallback, useRef } from 'react'
import { Send, Trash2, Settings, Paperclip, FileText, PenLine, MessageSquare } from 'lucide-react'
import { useChatStore, MessageAttachment } from '../../store/chatStore'
import { useEditorStore } from '../../store/editorStore'
import { usePromptStore } from '../../store/promptStore'
import { MessageList } from './MessageList'
import { SessionSelector } from './SessionSelector'
import { FileReference } from './FileReference'
import { PromptTemplateSelector } from './PromptTemplateSelector'
import { SettingsModal } from './SettingsModal'
import { streamChat, ApiConfig } from '../../lib/aiService'
import { useAIConfigStore } from '../../store/apiConfig'

// 两种模式：chat=对话模式, edit=直接编辑模式
type AiMode = 'chat' | 'edit'

export function AiChatPanel() {
  const [input, setInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [aiMode, setAiMode] = useState<AiMode>('edit')
  // 在 edit 模式下，流式结束后自动替换文档的标记
  const autoApplyRef = useRef(false)

  const {
    getActiveSession,
    isStreaming,
    addMessage,
    updateLastMessage,
    clearMessages,
    setStreaming,
    onDocumentChange,
  } = useChatStore()

  const { content: docContent, filePath } = useEditorStore()
  const { getActiveTemplate } = usePromptStore()
  const config = useAIConfigStore((s) => s.config)

  const activeSession = getActiveSession()

  useEffect(() => {
    const docPath = filePath ?? '__untitled__'
    onDocumentChange(docPath)
  }, [filePath, onDocumentChange])

  const messages = activeSession?.messages ?? []
  const template = getActiveTemplate()

  const handleAttach = useCallback((att: MessageAttachment) => {
    setAttachments((prev) => {
      if (prev.some((a) => a.path === att.path)) return prev
      return [...prev, att]
    })
  }, [])

  const handleRemoveAttach = useCallback((path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path))
  }, [])

  const attachCurrentDoc = () => {
    handleAttach({
      type: 'document',
      path: filePath ?? '__untitled__',
      content: docContent,
      name: filePath ? filePath.split('/').pop() ?? '当前文档' : '当前文档',
    })
  }

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isStreaming) return
    setInput('')

    const currentAttachments = [...attachments]
    setAttachments([])

    const hasDocAttached = currentAttachments.some((a) => a.type === 'document')
    const contextAttachments = hasDocAttached
      ? currentAttachments
      : [
          ...currentAttachments,
          {
            type: 'document' as const,
            path: filePath ?? '__untitled__',
            content: docContent,
            name: filePath ? filePath.split('/').pop() ?? '当前文档' : '当前文档',
          },
        ]

    addMessage({ role: 'user', content: prompt, attachments: contextAttachments })

    if (aiMode === 'edit') {
      // 直接编辑模式：AI 输出实时写入编辑器
      addMessage({ role: 'assistant', content: '✏️ 正在编辑文档...' })
      setStreaming(true)
      autoApplyRef.current = true

      try {
        const editSystemPrompt = getEditSystemPrompt(template.systemPrompt)
        let accumulated = ''
        await streamChat(
          config as ApiConfig,
          editSystemPrompt,
          [
            ...(activeSession?.messages ?? []),
            { id: '', role: 'user' as const, content: prompt, timestamp: 0, attachments: contextAttachments },
          ],
          (chunk) => {
            accumulated += chunk
            // 实时写入编辑器
            const { setContent } = useEditorStore.getState()
            setContent(accumulated)
            updateLastMessage(`✏️ 已写入编辑器 (${accumulated.length} 字)`)
          },
        )
        // 完成后更新消息
        updateLastMessage(`✅ 已更新文档 (${accumulated.length} 字)`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)
        updateLastMessage(`❌ 错误: ${msg}`)
      } finally {
        setStreaming(false)
        autoApplyRef.current = false
      }
    } else {
      // 对话模式：AI 输出显示在聊天框
      addMessage({ role: 'assistant', content: '' })
      setStreaming(true)

      try {
        let accumulated = ''
        await streamChat(
          config as ApiConfig,
          template.systemPrompt,
          [
            ...(activeSession?.messages ?? []),
            { id: '', role: 'user' as const, content: prompt, timestamp: 0, attachments: contextAttachments },
          ],
          (chunk) => {
            accumulated += chunk
            updateLastMessage(accumulated)
          },
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e)
        updateLastMessage(`错误: ${msg}`)
      } finally {
        setStreaming(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleApplyToDoc = (content: string) => {
    const { setContent } = useEditorStore.getState()
    setContent(content)
  }

  const handleAppendToDoc = (content: string) => {
    const { content: current, setContent } = useEditorStore.getState()
    setContent(current + '\n\n' + content)
  }

  const handleNewFile = async (content: string) => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        defaultPath: 'untitled.md',
      })
      if (path) {
        const { fileOps } = await import('../../lib/tauri')
        await fileOps.writeFile(path, content)
        const { setFilePath, setContent } = useEditorStore.getState()
        setFilePath(path)
        setContent(content)
      }
    } catch (e) {
      console.error('新建文件失败:', e)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <PromptTemplateSelector />
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="设置"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={clearMessages}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="清空对话"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setAiMode('edit')}
          className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full transition-colors ${
            aiMode === 'edit'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="AI 输出直接写入编辑器"
        >
          <PenLine size={10} />
          直接编辑
        </button>
        <button
          onClick={() => setAiMode('chat')}
          className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full transition-colors ${
            aiMode === 'chat'
              ? 'bg-blue-500 text-white'
              : 'border border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title="AI 输出显示在聊天框"
        >
          <MessageSquare size={10} />
          对话
        </button>
      </div>

      {/* Session selector */}
      <SessionSelector />

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
        {template.quickActions.map((a) => (
          <button
            key={a.label}
            onClick={() => sendMessage(a.prompt)}
            disabled={isStreaming}
            className="px-1.5 py-0.5 text-[10px] rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <MessageList messages={messages} onApplyToDoc={handleApplyToDoc} onAppendToDoc={handleAppendToDoc} onNewFile={handleNewFile} />

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 space-y-1 p-2">
        <FileReference
          attachments={attachments}
          onAttach={handleAttach}
          onRemove={handleRemoveAttach}
          currentDocContent={docContent}
          currentDocPath={filePath}
        />

        <div className="flex gap-1">
          <div className="flex flex-col gap-1 flex-1">
            <textarea
              className="flex-1 text-xs border rounded p-1.5 resize-none bg-transparent dark:border-gray-600 focus:outline-none min-h-[60px]"
              rows={3}
              placeholder={aiMode === 'edit' ? '描述你要写的内容，AI 会直接编辑文档...' : '输入消息... (@ 引用文件)'}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
            />
            <div className="flex gap-1">
              <button
                onClick={attachCurrentDoc}
                className={`p-1 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  attachments.some((a) => a.type === 'document')
                    ? 'text-blue-500'
                    : 'text-gray-400'
                }`}
                title="引用当前文档"
              >
                <FileText size={13} />
              </button>
              <button
                onClick={() => {}}
                className="p-1 rounded text-xs text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                title="引用文件"
              >
                <Paperclip size={13} />
              </button>
            </div>
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            className="self-end p-2 rounded bg-blue-500 text-white disabled:opacity-50"
          >
            <Send size={13} />
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

/** 直接编辑模式使用增强版 system prompt */
function getEditSystemPrompt(basePrompt: string): string {
  return basePrompt + '\n\n【重要】当前处于"直接编辑"模式。你的输出会实时写入用户的编辑器，直接替换整个文档内容。因此：\n- 直接输出完整的 Markdown 文档内容，不要加任何解释、说明或包裹\n- 不要输出"以下是修改后的内容："之类的前缀\n- 不要在 Markdown 内容前后加 ``` 代码块标记\n- 如果只是简单回答问题不需要修改文档，请用【不修改】开头，这样系统不会覆盖文档'
}
