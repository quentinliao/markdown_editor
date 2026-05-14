import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { buildExtensions } from './extensions'
import { useEditorStore } from '../../store/editorStore'

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function MarkdownEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { content, setContent, setCursorLine } = useEditorStore()

  const handleChange = useCallback(
    (value: string) => {
      setContent(value)
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        // 自动保存逻辑（Task 5 实现）
        saveTimer = null
      }, 500)
    },
    [setContent],
  )

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
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />
}
