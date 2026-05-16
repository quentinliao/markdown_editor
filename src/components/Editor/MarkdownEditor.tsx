import { useEffect, useRef, useCallback } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { buildExtensions } from './extensions'
import { useEditorStore } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'
import { registerEditor, unregisterEditor } from '../../lib/scrollSync'

const themeCompartment = new Compartment()

export function MarkdownEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInternalUpdateRef = useRef(false)
  const { content, setContent, setCursorLine } = useEditorStore()
  const fontSize = useUIStore((s) => s.fontSize)
  const theme = useUIStore((s) => s.theme)

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const handleChange = useCallback(
    (value: string) => {
      isInternalUpdateRef.current = true
      setContent(value)
      isInternalUpdateRef.current = false
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
      }, 500)
    },
    [setContent],
  )

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...buildExtensions(isDark, fontSize),
        themeCompartment.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleChange(update.state.doc.toString())
          }
          const line = update.state.doc.lineAt(update.state.selection.main.head)
          setCursorLine(line.number)
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    // 注册滚动同步（直接操作 DOM，不经过 React 状态）
    registerEditor(view.scrollDOM)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      unregisterEditor(view.scrollDOM)
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 同步外部 content 变更（如文件打开、AI 插入、预览区格式化）到编辑器
  useEffect(() => {
    const view = viewRef.current
    if (!view || isInternalUpdateRef.current) return
    const currentDoc = view.state.doc.toString()
    if (currentDoc === content) return
    view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: content },
    })
  }, [content])

  // 字体大小变化时重建编辑器
  const fontSizeRef = useRef(fontSize)
  useEffect(() => {
    if (fontSizeRef.current === fontSize || !viewRef.current) return
    fontSizeRef.current = fontSize
    const view = viewRef.current
    const oldDom = view.scrollDOM
    const currentDoc = view.state.doc.toString()
    const sel = view.state.selection
    view.destroy()
    unregisterEditor(oldDom)

    const state = EditorState.create({
      doc: currentDoc,
      selection: sel,
      extensions: [
        ...buildExtensions(isDark, fontSize),
        themeCompartment.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleChange(update.state.doc.toString())
          }
          const line = update.state.doc.lineAt(update.state.selection.main.head)
          setCursorLine(line.number)
        }),
      ],
    })
    const newView = new EditorView({ state, parent: containerRef.current! })
    viewRef.current = newView
    registerEditor(newView.scrollDOM)
  }, [fontSize, isDark, handleChange, setCursorLine])

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />
}
