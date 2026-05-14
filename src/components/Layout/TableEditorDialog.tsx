import { useState, useRef, useEffect } from 'react'
import { X, Plus, Minus, Check } from 'lucide-react'

interface TableEditorDialogProps {
  open: boolean
  onClose: () => void
  onInsert: (markdown: string) => void
}

export function TableEditorDialog({ open, onClose, onInsert }: TableEditorDialogProps) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [headerRow, setHeaderRow] = useState(true)
  const [cells, setCells] = useState<string[][]>([])
  const [focusCell, setFocusCell] = useState<{ r: number; c: number } | null>(null)
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // 初始化/调整表格大小
  useEffect(() => {
    if (!open) return
    setCells((prev) => {
      const next: string[][] = []
      for (let r = 0; r < rows; r++) {
        const row: string[] = []
        for (let c = 0; c < cols; c++) {
          row.push(prev[r]?.[c] ?? '')
        }
        next.push(row)
      }
      return next
    })
  }, [rows, cols, open])

  // 自动聚焦第一个单元格
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      const el = inputRefs.current.get('0-0')
      el?.focus()
    }, 100)
    return () => clearTimeout(timer)
  }, [open])

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    const key = e.key
    let nr = r, nc = c
    if (key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        nc = c - 1
        if (nc < 0) { nc = cols - 1; nr = r - 1 }
        if (nr < 0) return
      } else {
        nc = c + 1
        if (nc >= cols) { nc = 0; nr = r + 1 }
        if (nr >= rows) { handleInsert(); return }
      }
      inputRefs.current.get(`${nr}-${nc}`)?.focus()
    } else if (key === 'ArrowUp' && r > 0) {
      e.preventDefault()
      inputRefs.current.get(`${r - 1}-${c}`)?.focus()
    } else if (key === 'ArrowDown' && r < rows - 1) {
      e.preventDefault()
      inputRefs.current.get(`${r + 1}-${c}`)?.focus()
    } else if (key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (r < rows - 1) {
        inputRefs.current.get(`${r + 1}-${c}`)?.focus()
      } else {
        handleInsert()
      }
    }
  }

  const updateCell = (r: number, c: number, value: string) => {
    setCells((prev) => {
      const next = prev.map((row) => [...row])
      next[r][c] = value
      return next
    })
  }

  const handleInsert = () => {
    const lines: string[] = []
    const startRow = headerRow ? 0 : 0
    const headerCells = cells[startRow] || Array(cols).fill('列')

    lines.push('| ' + headerCells.map((c) => c || ' ').join(' | ') + ' |')
    lines.push('| ' + headerCells.map(() => '------').join(' | ') + ' |')

    const dataStart = headerRow ? 1 : 0
    for (let r = dataStart; r < rows; r++) {
      lines.push('| ' + (cells[r] || Array(cols).fill('')).map((c) => c || ' ').join(' | ') + ' |')
    }

    onInsert('\n' + lines.join('\n') + '\n')
    onClose()
    // 重置
    setCells([])
    setRows(3)
    setCols(3)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 w-[90vw] max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">插入表格</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* 控制栏 */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-xs">
          <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            行数
            <button onClick={() => setRows((r) => Math.max(1, r - 1))} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
              <Minus size={12} />
            </button>
            <span className="w-6 text-center font-medium">{rows}</span>
            <button onClick={() => setRows((r) => Math.min(20, r + 1))} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
              <Plus size={12} />
            </button>
          </label>
          <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            列数
            <button onClick={() => setCols((c) => Math.max(1, c - 1))} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
              <Minus size={12} />
            </button>
            <span className="w-6 text-center font-medium">{cols}</span>
            <button onClick={() => setCols((c) => Math.min(10, c + 1))} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600">
              <Plus size={12} />
            </button>
          </label>
          <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} className="rounded" />
            表头行
          </label>
        </div>

        {/* 表格网格 */}
        <div className="flex-1 overflow-auto px-4 py-3">
          <table className="w-full border-collapse">
            <tbody>
              {Array.from({ length: rows }, (_, r) => (
                <tr key={r}>
                  {Array.from({ length: cols }, (_, c) => {
                    const isHeader = headerRow && r === 0
                    return (
                      <td
                        key={c}
                        className={`border border-gray-300 dark:border-gray-600 p-0 ${
                          isHeader ? 'bg-gray-100 dark:bg-gray-700' : ''
                        }`}
                      >
                        <input
                          ref={(el) => {
                            if (el) inputRefs.current.set(`${r}-${c}`, el)
                            else inputRefs.current.delete(`${r}-${c}`)
                          }}
                          type="text"
                          value={cells[r]?.[c] ?? ''}
                          onChange={(e) => updateCell(r, c, e.target.value)}
                          onFocus={() => setFocusCell({ r, c })}
                          onBlur={() => setFocusCell(null)}
                          onKeyDown={(e) => handleKeyDown(e, r, c)}
                          placeholder={isHeader ? `表头 ${c + 1}` : ''}
                          className={`w-full px-2 py-1.5 bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100 placeholder:text-gray-400 ${
                            focusCell?.r === r && focusCell?.c === c
                              ? 'ring-1 ring-blue-400'
                              : ''
                          } ${isHeader ? 'font-medium' : ''}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleInsert}
            className="px-4 py-1.5 text-xs rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
          >
            <Check size={14} />
            插入
          </button>
        </div>
      </div>
    </div>
  )
}
