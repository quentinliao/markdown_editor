import { useRef, useCallback } from 'react'

interface ResizeHandleProps {
  /** 拖拽时回调，dx > 0 表示鼠标向右移动 */
  onResize: (dx: number) => void
}

/**
 * 可拖拽的分隔线。
 * dx > 0 = 鼠标向右 → 调用者自行决定面板宽度加减。
 */
export function ResizeHandle({ onResize }: ResizeHandleProps) {
  const startXRef = useRef(0)
  const draggingRef = useRef(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      startXRef.current = e.clientX
      draggingRef.current = true

      const handleMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return
        const dx = ev.clientX - startXRef.current
        startXRef.current = ev.clientX
        onResize(dx)
      }

      const handleMouseUp = () => {
        draggingRef.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [onResize],
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      className="group relative flex-shrink-0"
      style={{ width: 6, cursor: 'col-resize', zIndex: 10 }}
    >
      {/* 拖拽热区 */}
      <div className="absolute inset-y-0 -left-2 -right-2" />
      {/* 可见的分隔线 */}
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-transparent group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-colors"
        style={{ pointerEvents: 'none' }}
      />
    </div>
  )
}
