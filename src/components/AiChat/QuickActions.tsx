const ACTIONS = [
  { label: '续写', prompt: '请根据上下文继续写作' },
  { label: '润色', prompt: '请润色以下文字，使其更流畅自然' },
  { label: '摘要', prompt: '请为以下文档生成简洁摘要' },
  { label: '翻译', prompt: '请将以下内容翻译成英文' },
  { label: '扩写', prompt: '请对以下内容进行详细扩写' },
]

export function QuickActions({ onAction }: { onAction: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700">
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.prompt)}
          className="px-2 py-0.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
