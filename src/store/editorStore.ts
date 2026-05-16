import { create } from 'zustand'
import { fileOps } from '../lib/tauri'

const WELCOME_CONTENT = '# 欢迎使用 Markdown Preview\n\n开始写作...\n\n## 功能\n\n- **Markdown** 语法高亮\n- 实时预览\n- AI 写作助手\n'

const STORAGE_KEY_FILE = 'lastOpenedFile'
const STORAGE_KEY_TEMP = 'tempEditorState'

interface EditorState {
  content: string
  filePath: string | null
  isDirty: boolean
  cursorLine: number
  /** 上次成功保存到磁盘的内容快照（用于自动保存时比较） */
  lastSavedContent: string
  setContent: (content: string) => void
  setFilePath: (path: string | null) => void
  setDirty: (dirty: boolean) => void
  setCursorLine: (line: number) => void
  openFile: (path: string, content: string) => void
  newFile: () => void
  save: () => Promise<void>
  saveAs: (path: string) => Promise<void>
  /** 自动保存：有 filePath + dirty 时写入文件；否则保存到 localStorage 临时区 */
  autoSave: () => Promise<void>
  /** 恢复上次打开的文件（启动时调用） */
  restoreLastFile: () => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  content: WELCOME_CONTENT,
  filePath: null,
  isDirty: false,
  cursorLine: 1,
  lastSavedContent: WELCOME_CONTENT,

  setContent: (content) => {
    set({ content, isDirty: true })
    // 临时文件内容也持久化到 localStorage
    persistTemp(get())
  },

  setFilePath: (filePath) => {
    set({ filePath })
    if (filePath) {
      localStorage.setItem(STORAGE_KEY_FILE, filePath)
    } else {
      localStorage.removeItem(STORAGE_KEY_FILE)
    }
  },
  setDirty: (isDirty) => set({ isDirty }),
  setCursorLine: (cursorLine) => set({ cursorLine }),

  openFile: (path, content) => {
    set({ content, filePath: path, isDirty: false, lastSavedContent: content })
    localStorage.setItem(STORAGE_KEY_FILE, path)
    // 有正式文件后清除临时区
    localStorage.removeItem(STORAGE_KEY_TEMP)
  },

  newFile: () => {
    set({ content: '', filePath: null, isDirty: false, lastSavedContent: '' })
    localStorage.removeItem(STORAGE_KEY_FILE)
    localStorage.removeItem(STORAGE_KEY_TEMP)
  },

  save: async () => {
    const { filePath, content } = get()
    if (!filePath) return
    await fileOps.writeFile(filePath, content)
    set({ isDirty: false, lastSavedContent: content })
  },

  saveAs: async (path) => {
    const { content } = get()
    await fileOps.writeFile(path, content)
    set({ filePath: path, isDirty: false, lastSavedContent: content })
    localStorage.setItem(STORAGE_KEY_FILE, path)
    localStorage.removeItem(STORAGE_KEY_TEMP)
  },

  autoSave: async () => {
    const { filePath, content, isDirty } = get()
    if (!isDirty) return

    if (filePath) {
      // 已有文件路径 → 写入磁盘
      await fileOps.writeFile(filePath, content)
      set({ isDirty: false, lastSavedContent: content })
    } else {
      // 未保存的临时文件 → 写入 localStorage
      persistTemp(get())
    }
  },

  restoreLastFile: async () => {
    const lastPath = localStorage.getItem(STORAGE_KEY_FILE)
    if (lastPath) {
      try {
        const content = await fileOps.readFile(lastPath)
        set({ content, filePath: lastPath, isDirty: false, lastSavedContent: content })
        return
      } catch {
        localStorage.removeItem(STORAGE_KEY_FILE)
      }
    }
    // 没有正式文件 → 尝试恢复临时文件
    const tempRaw = localStorage.getItem(STORAGE_KEY_TEMP)
    if (tempRaw) {
      try {
        const temp: { content: string } = JSON.parse(tempRaw)
        set({ content: temp.content, filePath: null, isDirty: false, lastSavedContent: temp.content })
      } catch {
        localStorage.removeItem(STORAGE_KEY_TEMP)
      }
    }
  },
}))

/** 将临时编辑器状态持久化到 localStorage */
function persistTemp(state: { filePath: string | null; content: string }) {
  if (!state.filePath) {
    try {
      localStorage.setItem(STORAGE_KEY_TEMP, JSON.stringify({ content: state.content }))
    } catch {
      // localStorage 满了，忽略
    }
  }
}
