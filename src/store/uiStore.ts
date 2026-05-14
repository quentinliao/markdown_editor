import { create } from 'zustand'

export type ViewMode = 'full' | 'editor-only' | 'preview-only' | 'no-ai'

interface UIState {
  viewMode: ViewMode
  sidebarWidth: number
  aiPanelWidth: number
  setViewMode: (mode: ViewMode) => void
  setSidebarWidth: (w: number) => void
  setAiPanelWidth: (w: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'full',
  sidebarWidth: 220,
  aiPanelWidth: 280,
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setAiPanelWidth: (w) => set({ aiPanelWidth: w }),
}))
