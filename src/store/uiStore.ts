import { create } from 'zustand'

export type ViewMode = 'full' | 'editor-only' | 'preview-only' | 'no-ai'
export type Theme = 'light' | 'dark' | 'system'
export type ScrollSource = 'editor' | 'preview' | null

interface UIState {
  viewMode: ViewMode
  sidebarWidth: number
  aiPanelWidth: number
  theme: Theme
  fontSize: number
  scrollRatio: number
  scrollSource: ScrollSource
  setViewMode: (mode: ViewMode) => void
  setSidebarWidth: (w: number) => void
  setAiPanelWidth: (w: number) => void
  setTheme: (theme: Theme) => void
  setFontSize: (size: number) => void
  setScrollRatio: (ratio: number, source: ScrollSource) => void
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'full',
  sidebarWidth: 220,
  aiPanelWidth: 280,
  theme: 'system',
  fontSize: 14,
  scrollRatio: 0,
  scrollSource: null,
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setAiPanelWidth: (w) => set({ aiPanelWidth: w }),
  setTheme: (theme) => set({ theme }),
  setFontSize: (size) => set({ fontSize: size }),
  setScrollRatio: (ratio, source) => set({ scrollRatio: ratio, scrollSource: source }),
}))
