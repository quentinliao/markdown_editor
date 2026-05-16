import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ColorScheme {
  heading: string
  blockquote: string
  inlineCode: string
  codeBlockBg: string
}

export const defaultLightColors: ColorScheme = {
  heading: '#0695bf',
  blockquote: '#1F8D5C',
  inlineCode: '#1F8D5C',
  codeBlockBg: '#F7F8F8',
}

export const defaultDarkColors: ColorScheme = {
  heading: '#4cc9f0',
  blockquote: '#34d399',
  inlineCode: '#34d399',
  codeBlockBg: '#1e293b',
}

interface ThemeColorState {
  lightColors: ColorScheme
  darkColors: ColorScheme
  setLightColors: (colors: Partial<ColorScheme>) => void
  setDarkColors: (colors: Partial<ColorScheme>) => void
  resetColors: () => void
}

export const useThemeColorStore = create<ThemeColorState>()(
  persist(
    (set) => ({
      lightColors: { ...defaultLightColors },
      darkColors: { ...defaultDarkColors },
      setLightColors: (colors) =>
        set((s) => ({ lightColors: { ...s.lightColors, ...colors } })),
      setDarkColors: (colors) =>
        set((s) => ({ darkColors: { ...s.darkColors, ...colors } })),
      resetColors: () =>
        set({
          lightColors: { ...defaultLightColors },
          darkColors: { ...defaultDarkColors },
        }),
    }),
    {
      name: 'theme-color-store',
    },
  ),
)

/** 将颜色方案应用为 CSS 变量到根元素 */
export function applyThemeColors(isDark: boolean) {
  const { lightColors, darkColors } = useThemeColorStore.getState()
  const colors = isDark ? darkColors : lightColors
  const root = document.documentElement
  root.style.setProperty('--color-heading', colors.heading)
  root.style.setProperty('--color-blockquote', colors.blockquote)
  root.style.setProperty('--color-inline-code', colors.inlineCode)
  root.style.setProperty('--color-code-bg', colors.codeBlockBg)
}
