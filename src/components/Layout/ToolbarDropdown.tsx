import { useState, useRef, useEffect, ReactNode } from 'react'

interface ToolbarDropdownProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
}

export function ToolbarDropdown({ trigger, children, align = 'right' }: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`absolute top-full mt-1 z-50 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps {
  children: ReactNode
  onClick?: () => void
  checked?: boolean
  shortcut?: string
}

export function DropdownItem({ children, onClick, checked, shortcut }: DropdownItemProps) {
  return (
    <button
      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700"
      onClick={onClick}
    >
      <span className="w-4 text-center">{checked ? '✓' : ''}</span>
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-gray-400">{shortcut}</span>}
    </button>
  )
}

interface DropdownSeparatorProps {}

export function DropdownSeparator(_props: DropdownSeparatorProps) {
  return <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
}
