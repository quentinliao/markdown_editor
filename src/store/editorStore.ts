import { create } from 'zustand'

interface EditorState {
  content: string
  filePath: string | null
  isDirty: boolean
  cursorLine: number
  setContent: (content: string) => void
  setFilePath: (path: string | null) => void
  setDirty: (dirty: boolean) => void
  setCursorLine: (line: number) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '# 欢迎使用 Markdown Preview\n\n开始写作...\n\n## 功能\n\n- **Markdown** 语法高亮\n- 实时预览\n- AI 写作助手\n',
  filePath: null,
  isDirty: false,
  cursorLine: 1,
  setContent: (content) => set({ content, isDirty: true }),
  setFilePath: (filePath) => set({ filePath }),
  setDirty: (isDirty) => set({ isDirty }),
  setCursorLine: (cursorLine) => set({ cursorLine }),
}))
