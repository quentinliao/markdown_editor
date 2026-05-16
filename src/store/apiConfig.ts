import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ApiConfig, DEFAULT_API_CONFIG } from '../lib/aiService'

interface ApiConfigState {
  config: ApiConfig
  setConfig: (config: ApiConfig) => void
}

export const useAIConfigStore = create<ApiConfigState>()(
  persist(
    (set) => ({
      config: DEFAULT_API_CONFIG,
      setConfig: (config) => set({ config }),
    }),
    {
      name: 'ai-api-config',
      merge: (persisted, current) => {
        const p = persisted as Partial<ApiConfigState>
        return {
          ...current,
          config: p.config
            ? { ...DEFAULT_API_CONFIG, ...p.config }
            : current.config,
        }
      },
    },
  ),
)
