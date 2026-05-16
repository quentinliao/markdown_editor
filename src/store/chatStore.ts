import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface MessageAttachment {
  type: 'file' | 'document'
  path: string
  content: string
  name: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  attachments?: MessageAttachment[]
}

export interface Session {
  id: string
  documentPath: string
  title: string
  messages: Message[]
  promptTemplateId: string | null
  createdAt: number
  updatedAt: number
}

interface ChatState {
  sessions: Record<string, Session[]>
  activeSessionId: string | null
  isStreaming: boolean

  // Session actions
  getSessionsForDocument: (docPath: string) => Session[]
  createSession: (docPath: string, title?: string) => Session
  switchSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  renameSession: (sessionId: string, title: string) => void
  getActiveSession: () => Session | null
  onDocumentChange: (docPath: string) => void

  // Message actions
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  updateLastMessage: (content: string) => void
  clearMessages: () => void

  // Streaming
  setStreaming: (v: boolean) => void
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: {},
      activeSessionId: null,
      isStreaming: false,

      getSessionsForDocument: (docPath) => {
        return get().sessions[docPath] ?? []
      },

      createSession: (docPath, title) => {
        const session: Session = {
          id: generateId(),
          documentPath: docPath,
          title: title ?? '新对话',
          messages: [],
          promptTemplateId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => {
          const docSessions = s.sessions[docPath] ?? []
          return {
            sessions: { ...s.sessions, [docPath]: [session, ...docSessions] },
            activeSessionId: session.id,
          }
        })
        return session
      },

      switchSession: (sessionId) => set({ activeSessionId: sessionId }),

      deleteSession: (sessionId) =>
        set((s) => {
          const sessions = { ...s.sessions }
          for (const docPath of Object.keys(sessions)) {
            sessions[docPath] = sessions[docPath].filter((ss) => ss.id !== sessionId)
            if (sessions[docPath].length === 0) delete sessions[docPath]
          }
          const activeSessionId =
            s.activeSessionId === sessionId ? null : s.activeSessionId
          return { sessions, activeSessionId }
        }),

      renameSession: (sessionId, title) =>
        set((s) => {
          const sessions = { ...s.sessions }
          for (const docPath of Object.keys(sessions)) {
            sessions[docPath] = sessions[docPath].map((ss) =>
              ss.id === sessionId ? { ...ss, title, updatedAt: Date.now() } : ss,
            )
          }
          return { sessions }
        }),

      getActiveSession: () => {
        const { sessions, activeSessionId } = get()
        if (!activeSessionId) return null
        for (const docSessions of Object.values(sessions)) {
          const found = docSessions.find((s) => s.id === activeSessionId)
          if (found) return found
        }
        return null
      },

      onDocumentChange: (docPath) => {
        const { sessions } = get()
        const docSessions = sessions[docPath] ?? []
        if (docSessions.length > 0) {
          // activate the most recently updated session
          const latest = docSessions.reduce((a, b) =>
            a.updatedAt > b.updatedAt ? a : b,
          )
          set({ activeSessionId: latest.id })
        } else {
          // auto-create a new session for this document
          get().createSession(docPath)
        }
      },

      addMessage: (msg) => {
        const id = generateId()
        const message: Message = { ...msg, id, timestamp: Date.now() }
        set((s) => {
          const { activeSessionId, sessions } = s
          if (!activeSessionId) return s
          const updated = { ...sessions }
          for (const docPath of Object.keys(updated)) {
            updated[docPath] = updated[docPath].map((ss) =>
              ss.id === activeSessionId
                ? { ...ss, messages: [...ss.messages, message], updatedAt: Date.now() }
                : ss,
            )
          }
          return { sessions: updated }
        })
        return id
      },

      updateLastMessage: (content) =>
        set((s) => {
          const { activeSessionId, sessions } = s
          if (!activeSessionId) return s
          const updated = { ...sessions }
          for (const docPath of Object.keys(updated)) {
            updated[docPath] = updated[docPath].map((ss) => {
              if (ss.id !== activeSessionId) return ss
              const msgs = [...ss.messages]
              if (msgs.length > 0) {
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content }
              }
              return { ...ss, messages: msgs, updatedAt: Date.now() }
            })
          }
          return { sessions: updated }
        }),

      clearMessages: () =>
        set((s) => {
          const { activeSessionId, sessions } = s
          if (!activeSessionId) return s
          const updated = { ...sessions }
          for (const docPath of Object.keys(updated)) {
            updated[docPath] = updated[docPath].map((ss) =>
              ss.id === activeSessionId ? { ...ss, messages: [], updatedAt: Date.now() } : ss,
            )
          }
          return { sessions: updated }
        }),

      setStreaming: (isStreaming) => set({ isStreaming }),
    }),
    {
      name: 'chat-store',
      partialize: (s) => ({ sessions: s.sessions }),
    },
  ),
)
