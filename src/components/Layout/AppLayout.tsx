import { ReactNode } from 'react'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { useUIStore } from '../../store/uiStore'

interface AppLayoutProps {
  sidebar: ReactNode
  aiChat: ReactNode
  editor: ReactNode
  preview: ReactNode
  toolbarProps?: { onSearchToggle?: () => void }
  statusProps: { wordCount: number; lineCount: number; filePath?: string }
}

export function AppLayout({ sidebar, aiChat, editor, preview, toolbarProps, statusProps }: AppLayoutProps) {
  const { viewMode, sidebarWidth, aiPanelWidth } = useUIStore()
  const showAi = viewMode === 'full'
  const showPreview = viewMode === 'full' || viewMode === 'no-ai' || viewMode === 'preview-only'
  const showEditor = viewMode !== 'preview-only'

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Toolbar {...toolbarProps} />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div
          style={{ width: sidebarWidth }}
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto"
        >
          {sidebar}
        </div>
        {showAi && (
          <div
            style={{ width: aiPanelWidth }}
            className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col"
          >
            {aiChat}
          </div>
        )}
        {showEditor && (
          <div className="flex-1 min-w-0 overflow-hidden">
            {editor}
          </div>
        )}
        {showPreview && (
          <div className="flex-1 min-w-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            {preview}
          </div>
        )}
      </div>
      <StatusBar {...statusProps} />
    </div>
  )
}
