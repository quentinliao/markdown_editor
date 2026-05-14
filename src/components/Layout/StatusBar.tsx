interface StatusBarProps {
  wordCount: number
  lineCount: number
  filePath?: string
}

export function StatusBar({ wordCount, lineCount, filePath }: StatusBarProps) {
  return (
    <div className="h-6 flex items-center gap-4 px-3 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
      <span>{wordCount} 字</span>
      <span>第 {lineCount} 行</span>
      {filePath && <span className="truncate">{filePath}</span>}
    </div>
  )
}
