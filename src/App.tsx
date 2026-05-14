import { AppLayout } from './components/Layout/AppLayout'

function App() {
  return (
    <AppLayout
      sidebar={<div className="p-3 text-sm text-gray-500">侧边栏（待实现）</div>}
      aiChat={<div className="p-3 text-sm text-gray-500">AI Chat（待实现）</div>}
      editor={<div className="p-3 text-sm text-gray-500">编辑器（待实现）</div>}
      preview={<div className="p-3 text-sm text-gray-500">预览（待实现）</div>}
      statusProps={{ wordCount: 0, lineCount: 1 }}
    />
  )
}

export default App
