import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { buildExtensions } from './extensions'
import { useEditorStore } from '../../store/editorStore'

export function MarkdownEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInternalUpdateRef = useRef(false)
  const { content, setContent, setCursorLine } = useEditorStore()

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

  // 初始化编辑器实例（仅 mount 时创建）
  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        ...buildExtensions(false),
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

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 同步外部 content 变更（如文件打开、AI 插入）到编辑器
  useEffect(() => {
    const view = viewRef.current
    if (!view || isInternalUpdateRef.current) return
    const currentDoc = view.state.doc.toString()
    if (currentDoc === content) return
    view.dispatch({
      changes: { from: 0, to: currentDoc.length, insert: content },
    })
  }, [content])

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />
}
