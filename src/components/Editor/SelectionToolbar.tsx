import { useState, useRef, useEffect, useCallback } from 'react'

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#78716c',
]

const BG_COLORS = [
  '#fef9c3', '#fef08a', '#fde68a', '#fcd34d',
  '#d1fae5', '#a7f3d0', '#bae6fd', '#bfdbfe', '#c7d2fe',
  '#ddd6fe', '#f5d0fe', '#fecdd3', '#fed7aa', '#fdba74',
]

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]

type DropType = 'textColor' | 'bgColor' | 'fontSize' | null

interface SelectionToolbarProps {
  onFormat: (action: string, value?: string) => void
}

export function SelectionToolbar({ onFormat }: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [drop, setDrop] = useState<DropType>(null)
  const [lastTextColor, setLastTextColor] = useState('#ef4444')
  const [lastBgColor, setLastBgColor] = useState('#fef08a')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const savedSelectionRef = useRef<{ text: string; range: Range | null }>({ text: '', range: null })
  // 锁定：toolbar 打开后锁定住，只在用户点击外部时才关闭
  const lockedRef = useRef(false)

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
    setPosition(null)
    setDrop(null)
    lockedRef.current = false
    savedSelectionRef.current = { text: '', range: null }
  }, [])

  const scheduleShow = useCallback(() => {
    // 如果 toolbar 已锁定显示，不重复触发
    if (lockedRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setVisible(false)
        setPosition(null)
        return
      }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return

      savedSelectionRef.current = {
        text: sel.toString(),
        range: range.cloneRange(),
      }

      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top < 48 ? rect.bottom + 6 : rect.top - 42,
      })
      setVisible(true)
      lockedRef.current = true
      setDrop(null)
    }, 500)
  }, [])

  useEffect(() => {
    const onMouseUp = () => scheduleShow()
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && ref.current.contains(e.target as Node)) return
      hide()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      // 只在按 Esc 或 Tab 时关闭，其他按键不关闭
      if (e.key === 'Escape') hide()
    }

    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [scheduleShow, hide])

  if (!visible || !position) return null

  const preventBlur = (e: React.MouseEvent) => e.preventDefault()

  const handleFormat = (action: string, value?: string) => {
    if (savedSelectionRef.current.range) {
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(savedSelectionRef.current.range)
      }
    }
    onFormat(action, value)
    // toolbar 保持锁定，不消失
    lockedRef.current = true
  }

  return (
    <div
      ref={ref}
      className="fixed z-[1000] flex items-center gap-px rounded-lg bg-white dark:bg-gray-800 px-1 py-0.5 shadow-lg border border-gray-200 dark:border-gray-600"
      style={{ left: position.x, top: position.y, transform: 'translateX(-50%)' }}
      onMouseDown={preventBlur}
    >
      <ToolBtn title="粗体 ⌘B" onClick={() => handleFormat('bold')}>
        <span className="font-bold text-[13px]">B</span>
      </ToolBtn>
      <ToolBtn title="斜体 ⌘I" onClick={() => handleFormat('italic')}>
        <span className="italic text-[13px]">I</span>
      </ToolBtn>
      <ToolBtn title="删除线" onClick={() => handleFormat('strike')}>
        <span className="line-through text-[13px]">S</span>
      </ToolBtn>
      <ToolBtn title="下划线" onClick={() => handleFormat('underline')}>
        <span className="underline text-[13px]">U</span>
      </ToolBtn>

      <Sep />

      {/* 文字颜色 */}
      <div className="relative flex">
        <ToolBtn title={`文字颜色: ${lastTextColor}`} onClick={() => handleFormat('color', lastTextColor)}>
          <span className="flex items-center gap-0.5">
            <span className="font-bold text-[13px]">A</span>
            <span className="inline-block h-[3px] w-3 rounded-full" style={{ backgroundColor: lastTextColor }} />
          </span>
        </ToolBtn>
        <button
          title="选择文字颜色"
          onMouseDown={preventBlur}
          onClick={() => setDrop(drop === 'textColor' ? null : 'textColor')}
          className="flex items-center justify-center w-3 h-7 rounded-r-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1 3l3 3 3-3z" /></svg>
        </button>
        {drop === 'textColor' && (
          <DropPanel>
            <div className="text-[10px] text-gray-400 mb-1.5">文字颜色</div>
            <div className="grid grid-cols-5 gap-1" style={{ width: 110 }}>
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onMouseDown={preventBlur}
                  onClick={() => { setLastTextColor(c); handleFormat('color', c) }}
                  className="inline-block rounded border border-gray-200 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ width: 18, height: 18, backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-600 flex items-center gap-1.5">
              <input
                type="color"
                value={lastTextColor}
                onChange={(e) => { setLastTextColor(e.target.value); handleFormat('color', e.target.value) }}
                className="w-6 h-5 rounded cursor-pointer border-0 p-0"
                onMouseDown={preventBlur}
              />
              <span className="text-[10px] text-gray-400">自定义</span>
            </div>
          </DropPanel>
        )}
      </div>

      {/* 背景颜色 */}
      <div className="relative flex">
        <ToolBtn title={`背景颜色: ${lastBgColor}`} onClick={() => handleFormat('bgColor', lastBgColor)}>
          <span className="flex items-center gap-0.5">
            <span className="font-bold text-[13px]">A</span>
            <span className="inline-block rounded-sm border border-gray-300" style={{ width: 12, height: 12, backgroundColor: lastBgColor }} />
          </span>
        </ToolBtn>
        <button
          title="选择背景颜色"
          onMouseDown={preventBlur}
          onClick={() => setDrop(drop === 'bgColor' ? null : 'bgColor')}
          className="flex items-center justify-center w-3 h-7 rounded-r-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1 3l3 3 3-3z" /></svg>
        </button>
        {drop === 'bgColor' && (
          <DropPanel>
            <div className="text-[10px] text-gray-400 mb-1.5">背景颜色</div>
            <div className="grid grid-cols-5 gap-1" style={{ width: 110 }}>
              <button
                onMouseDown={preventBlur}
                onClick={() => handleFormat('bgColor', 'transparent')}
                className="inline-flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform bg-white"
                style={{ width: 18, height: 18 }}
                title="清除背景"
              >
                <span className="text-[7px] text-gray-400">无</span>
              </button>
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onMouseDown={preventBlur}
                  onClick={() => { setLastBgColor(c); handleFormat('bgColor', c) }}
                  className="inline-block rounded border border-gray-200 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ width: 18, height: 18, backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-600 flex items-center gap-1.5">
              <input
                type="color"
                value={lastBgColor}
                onChange={(e) => { setLastBgColor(e.target.value); handleFormat('bgColor', e.target.value) }}
                className="w-6 h-5 rounded cursor-pointer border-0 p-0"
                onMouseDown={preventBlur}
              />
              <span className="text-[10px] text-gray-400">自定义</span>
            </div>
          </DropPanel>
        )}
      </div>

      <Sep />

      <div className="relative">
        <ToolBtn
          title="字号"
          active={drop === 'fontSize'}
          onClick={() => setDrop(drop === 'fontSize' ? null : 'fontSize')}
        >
          <span className="text-[11px]">字号</span>
        </ToolBtn>
        {drop === 'fontSize' && (
          <DropPanel>
            <div className="text-[10px] text-gray-400 mb-1">选择字号</div>
            <div className="flex max-h-36 flex-col overflow-y-auto">
              {FONT_SIZES.map((s) => (
                <button
                  key={s}
                  onMouseDown={preventBlur}
                  onClick={() => handleFormat('fontSize', String(s))}
                  className="rounded px-3 py-0.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700"
                >
                  {s}px
                </button>
              ))}
            </div>
          </DropPanel>
        )}
      </div>

      <ToolBtn title="减小字号" onClick={() => handleFormat('shrink')}>
        <span className="text-[11px] font-medium">A<sub className="text-[8px]">-</sub></span>
      </ToolBtn>
      <ToolBtn title="增大字号" onClick={() => handleFormat('grow')}>
        <span className="text-[13px] font-semibold">A<sup className="text-[8px]">+</sup></span>
      </ToolBtn>
    </div>
  )
}

function ToolBtn({
  title,
  onClick,
  active,
  children,
}: {
  title: string
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      title={title}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1 text-gray-700 dark:text-gray-200 transition-colors ${
        active
          ? 'bg-blue-100 dark:bg-blue-900'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="mx-0.5 h-4 w-px bg-gray-200 dark:border-gray-600" />
}

function DropPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute left-1/2 top-full z-[1001] mt-1.5 -translate-x-1/2 rounded-lg bg-white dark:bg-gray-800 p-2 shadow-lg border border-gray-200 dark:border-gray-600">
      {children}
    </div>
  )
}
