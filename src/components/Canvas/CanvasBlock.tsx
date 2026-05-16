import { useRef, useEffect, useState, useCallback } from 'react'
import { Pencil, Square, Circle, Minus, Type, Eraser, Trash2 } from 'lucide-react'

interface Point { x: number; y: number }

interface BaseStroke { color: string; width: number }
interface FreehandStroke extends BaseStroke { type: 'freehand'; points: Point[] }
interface LineStroke extends BaseStroke { type: 'line'; from: Point; to: Point }
interface RectStroke extends BaseStroke { type: 'rect'; from: Point; to: Point; fill: string | null }
interface EllipseStroke extends BaseStroke { type: 'ellipse'; center: Point; rx: number; ry: number; fill: string | null }
interface TextStroke { type: 'text'; point: Point; text: string; color: string; size: number }

type Stroke = FreehandStroke | LineStroke | RectStroke | EllipseStroke | TextStroke

export interface CanvasData { strokes: Stroke[] }

type Tool = 'freehand' | 'line' | 'rect' | 'ellipse' | 'text' | 'eraser'

const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff']
const WIDTHS = [2, 4, 6, 10]

interface CanvasBlockProps {
  data: CanvasData
  onChange: (data: CanvasData) => void
}

export function CanvasBlock({ data, onChange }: CanvasBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Tool>('freehand')
  const [color, setColor] = useState('#000000')
  const [width, setWidth] = useState(2)
  const drawingRef = useRef(false)
  const startPosRef = useRef<Point>({ x: 0, y: 0 })
  const currentPointsRef = useRef<Point[]>([])
  const strokesRef = useRef<Stroke[]>(data.strokes)
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null)
  const pendingTextRef = useRef<{ point: Point; color: string; size: number } | null>(null)

  useEffect(() => { strokesRef.current = data.strokes }, [data.strokes])

  const redraw = useCallback((extra?: Stroke) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const all = extra ? [...strokesRef.current, extra] : strokesRef.current
    for (const s of all) drawStroke(ctx, s)
  }, [])

  useEffect(() => { redraw() }, [data.strokes, redraw])

  const getPos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  // Convert canvas coords to percentage of the wrapper div for CSS positioning
  const canvasToPercent = (canvas: HTMLCanvasElement, p: Point): { left: string; top: string } => {
    const rect = canvas.getBoundingClientRect()
    return {
      left: `${(p.x / canvas.width) * rect.width}px`,
      top: `${(p.y / canvas.height) * rect.height}px`,
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drawing if text input is open
    if (textInput) return
    const pos = getPos(e)

    if (tool === 'text') {
      const canvas = canvasRef.current!
      const cssPos = canvasToPercent(canvas, pos)
      const size = width * 4 + 14
      setTextInput({ x: cssPos.left as unknown as number, y: cssPos.top as unknown as number, value: '' })
      pendingTextRef.current = { point: pos, color, size }
      return
    }

    drawingRef.current = true
    startPosRef.current = pos
    currentPointsRef.current = [pos]
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawingRef.current) return
    const pos = getPos(e)

    if (tool === 'freehand') {
      currentPointsRef.current.push(pos)
      redraw({ type: 'freehand', points: currentPointsRef.current, color, width })
    } else if (tool === 'eraser') {
      currentPointsRef.current.push(pos)
      const threshold = width * 3
      const filtered = strokesRef.current.filter((s) => !isStrokeNear(s, pos, threshold))
      if (filtered.length !== strokesRef.current.length) {
        strokesRef.current = filtered
        onChange({ strokes: filtered })
      }
    } else {
      const preview = makeShapeStroke(tool, startPosRef.current, pos, color, width)
      if (preview) redraw(preview)
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const pos = getPos(e)

    if (tool === 'freehand') {
      const stroke: FreehandStroke = { type: 'freehand', points: currentPointsRef.current, color, width }
      strokesRef.current = [...strokesRef.current, stroke]
      onChange({ strokes: strokesRef.current })
    } else if (tool !== 'eraser') {
      const stroke = makeShapeStroke(tool, startPosRef.current, pos, color, width)
      if (stroke) {
        strokesRef.current = [...strokesRef.current, stroke]
        onChange({ strokes: strokesRef.current })
      }
    }
    redraw()
  }

  const handleTextConfirm = () => {
    const pending = pendingTextRef.current
    if (pending && textInput && textInput.value.trim()) {
      const stroke: TextStroke = {
        type: 'text',
        point: pending.point,
        text: textInput.value,
        color: pending.color,
        size: pending.size,
      }
      strokesRef.current = [...strokesRef.current, stroke]
      onChange({ strokes: strokesRef.current })
    }
    pendingTextRef.current = null
    setTextInput(null)
  }

  const handleClear = () => {
    strokesRef.current = []
    onChange({ strokes: [] })
  }

  // Compute text input position from canvas coords
  const getTextInputStyle = (): React.CSSProperties => {
    if (!textInput || !canvasRef.current) return { display: 'none' }
    const canvas = canvasRef.current
    const pending = pendingTextRef.current
    if (!pending) return { display: 'none' }
    const cssPos = canvasToPercent(canvas, pending.point)
    return {
      position: 'absolute',
      left: cssPos.left,
      top: cssPos.top,
      color: pending.color,
      fontSize: `${pending.size}px`,
      lineHeight: 1.2,
      maxWidth: '80%',
      background: 'transparent',
      border: '1px dashed #3b82f6',
      outline: 'none',
      padding: '1px 4px',
      fontFamily: 'sans-serif',
      zIndex: 10,
    }
  }

  return (
    <div className="canvas-block my-3 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden group">
      {/* Toolbar: visible on hover */}
      <div className="flex items-center gap-0.5 px-1.5 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600
                      opacity-0 h-0 overflow-hidden transition-all duration-150
                      group-hover:opacity-100 group-hover:h-auto group-hover:py-1">
        <ToolBtn active={tool === 'freehand'} onClick={() => setTool('freehand')} title="画笔">
          <Pencil size={13} />
        </ToolBtn>
        <ToolBtn active={tool === 'line'} onClick={() => setTool('line')} title="直线">
          <Minus size={13} />
        </ToolBtn>
        <ToolBtn active={tool === 'rect'} onClick={() => setTool('rect')} title="矩形">
          <Square size={13} />
        </ToolBtn>
        <ToolBtn active={tool === 'ellipse'} onClick={() => setTool('ellipse')} title="圆形">
          <Circle size={13} />
        </ToolBtn>
        <ToolBtn active={tool === 'text'} onClick={() => setTool('text')} title="文字">
          <Type size={13} />
        </ToolBtn>
        <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} title="橡皮擦">
          <Eraser size={13} />
        </ToolBtn>

        <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-600" />

        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`rounded border ${color === c ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}`}
            style={{ width: 14, height: 14, backgroundColor: c }}
            title={c}
          />
        ))}

        <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-600" />

        {WIDTHS.map((w) => (
          <button
            key={w}
            onClick={() => setWidth(w)}
            className={`rounded px-1 text-[9px] ${width === w ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {w}
          </button>
        ))}

        <div className="flex-1" />
        <button onClick={handleClear} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500" title="清空">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Canvas area */}
      <div ref={wrapperRef} className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
          className="w-full block"
          style={{ cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (drawingRef.current) drawingRef.current = false }}
        />
        {textInput && (
          <input
            autoFocus
            style={getTextInputStyle()}
            value={textInput.value}
            onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleTextConfirm() }
              if (e.key === 'Escape') { pendingTextRef.current = null; setTextInput(null) }
            }}
          />
        )}
      </div>
    </div>
  )
}

function ToolBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1 rounded ${active ? 'bg-blue-100 dark:bg-blue-900 text-blue-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
    >
      {children}
    </button>
  )
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.save()
  switch (s.type) {
    case 'freehand':
      if (s.points.length < 2) break
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y)
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y)
      ctx.stroke(); break
    case 'line':
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(s.from.x, s.from.y); ctx.lineTo(s.to.x, s.to.y); ctx.stroke(); break
    case 'rect': {
      const x = Math.min(s.from.x, s.to.x), y = Math.min(s.from.y, s.to.y)
      const w = Math.abs(s.to.x - s.from.x), h = Math.abs(s.to.y - s.from.y)
      if (s.fill) { ctx.fillStyle = s.fill; ctx.fillRect(x, y, w, h) }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.strokeRect(x, y, w, h); break
    }
    case 'ellipse':
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.beginPath()
      ctx.ellipse(s.center.x, s.center.y, Math.max(1, s.rx), Math.max(1, s.ry), 0, 0, Math.PI * 2)
      if (s.fill) { ctx.fillStyle = s.fill; ctx.fill() }
      ctx.stroke(); break
    case 'text':
      ctx.fillStyle = s.color; ctx.font = `${s.size}px sans-serif`
      ctx.fillText(s.text, s.point.x, s.point.y + s.size * 0.8); break
  }
  ctx.restore()
}

function makeShapeStroke(tool: Tool, from: Point, to: Point, color: string, width: number): Stroke | null {
  switch (tool) {
    case 'line': return { type: 'line', from, to, color, width }
    case 'rect': return { type: 'rect', from, to, color, width, fill: null }
    case 'ellipse': {
      const cx = (from.x + to.x) / 2, cy = (from.y + to.y) / 2
      return { type: 'ellipse', center: { x: cx, y: cy }, rx: Math.abs(to.x - from.x) / 2, ry: Math.abs(to.y - from.y) / 2, color, width, fill: null }
    }
    default: return null
  }
}

function isStrokeNear(s: Stroke, p: Point, threshold: number): boolean {
  switch (s.type) {
    case 'freehand': return s.points.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < threshold)
    case 'line': return distToSegment(p, s.from, s.to) < threshold
    case 'rect': {
      const x1 = Math.min(s.from.x, s.to.x), y1 = Math.min(s.from.y, s.to.y)
      const x2 = Math.max(s.from.x, s.to.x), y2 = Math.max(s.from.y, s.to.y)
      return distToSegment(p, { x: x1, y: y1 }, { x: x2, y: y1 }) < threshold ||
        distToSegment(p, { x: x2, y: y1 }, { x: x2, y: y2 }) < threshold ||
        distToSegment(p, { x: x2, y: y2 }, { x: x1, y: y2 }) < threshold ||
        distToSegment(p, { x: x1, y: y2 }, { x: x1, y: y1 }) < threshold
    }
    case 'ellipse': {
      const dx = (p.x - s.center.x) / Math.max(1, s.rx), dy = (p.y - s.center.y) / Math.max(1, s.ry)
      return Math.abs(Math.sqrt(dx * dx + dy * dy) - 1) * Math.max(s.rx, s.ry) < threshold
    }
    case 'text': return Math.abs(p.x - s.point.x) < s.text.length * s.size * 0.4 && Math.abs(p.y - s.point.y) < s.size
    default: return false
  }
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
