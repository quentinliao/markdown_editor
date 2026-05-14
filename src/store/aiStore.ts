import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

interface AiState {
  messages: Message[]
  config: AiConfig
  isStreaming: boolean
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  updateLastMessage: (content: string) => void
  clearMessages: () => void
  setConfig: (config: AiConfig) => void
  setStreaming: (v: boolean) => void
}

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      messages: [],
      config: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o' },
      isStreaming: false,
      addMessage: (msg) => {
        const id = Date.now().toString()
        set((s) => ({ messages: [...s.messages, { ...msg, id, timestamp: Date.now() }] }))
        return id
      },
      updateLastMessage: (content) => set((s) => {
        const msgs = [...s.messages]
        if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content }
        return { messages: msgs }
      }),
      clearMessages: () => set({ messages: [] }),
      setConfig: (config) => set({ config }),
      setStreaming: (isStreaming) => set({ isStreaming }),
    }),
    { name: 'ai-store', partialize: (s) => ({ config: s.config }) }
  )
)
