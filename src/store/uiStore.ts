import { create } from 'zustand'

export type ViewMode = 'full' | 'editor-only' | 'preview-only' | 'no-ai'
export type Theme = 'light' | 'dark' | 'system'

interface UIState {
  viewMode: ViewMode
  sidebarWidth: number
  aiPanelWidth: number
  theme: Theme
  fontSize: number
  setViewMode: (mode: ViewMode) => void
  setSidebarWidth: (w: number) => void
  setAiPanelWidth: (w: number) => void
  setTheme: (theme: Theme) => void
  setFontSize: (size: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'no-ai', // TODO: AI 功能完善后改为 'full'
  sidebarWidth: 220,
  aiPanelWidth: 280,
  theme: 'system',
  fontSize: 14,
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setAiPanelWidth: (w) => set({ aiPanelWidth: w }),
  setTheme: (theme) => set({ theme }),
  setFontSize: (size) => set({ fontSize: size }),
}))
