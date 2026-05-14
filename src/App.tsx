import { AppLayout } from './components/Layout/AppLayout'
import { MarkdownEditor } from './components/Editor/MarkdownEditor'
import { useEditorStore } from './store/editorStore'

function App() {
  const { content, cursorLine, filePath } = useEditorStore()

  return (
    <AppLayout
      sidebar={<div className="p-3 text-sm text-gray-500">侧边栏（待实现）</div>}
      aiChat={<div className="p-3 text-sm text-gray-500">AI Chat（待实现）</div>}
      editor={<MarkdownEditor />}
      preview={<div className="p-3 text-sm text-gray-500">预览（待实现）</div>}
      statusProps={{
        wordCount: content.length,
        lineCount: cursorLine,
        filePath: filePath ?? undefined,
      }}
    />
  )
}

export default App
