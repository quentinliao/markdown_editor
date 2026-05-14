import { useState, useEffect } from 'react'
import { AppLayout } from './components/Layout/AppLayout'
import { MarkdownEditor } from './components/Editor/MarkdownEditor'
import { MarkdownPreview } from './components/Preview/MarkdownPreview'
import { Sidebar } from './components/Sidebar/Sidebar'
import { AiChatPanel } from './components/AiChat/AiChatPanel'
import { SearchPanel } from './components/Search/SearchPanel'
import { useEditorStore } from './store/editorStore'
import { useUIStore } from './store/uiStore'

function App() {
  const { content, cursorLine, filePath } = useEditorStore()
  const theme = useUIStore((s) => s.theme)
  const [searchOpen, setSearchOpen] = useState(false)

  // 应用主题到 document
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme])

  return (
    <div className="relative">
      <AppLayout
        sidebar={<Sidebar />}
        aiChat={<AiChatPanel />}
        toolbarProps={{ onSearchToggle: () => setSearchOpen(!searchOpen) }}
        editor={<MarkdownEditor />}
        preview={<MarkdownPreview content={content} />}
        statusProps={{
          wordCount: content.length,
          lineCount: cursorLine,
          filePath: filePath ?? undefined,
        }}
      />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

export default App
