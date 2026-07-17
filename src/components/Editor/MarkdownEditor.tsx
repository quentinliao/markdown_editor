import { useEffect, useRef, useCallback, useState } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { buildStaticExtensions, buildThemeExtensions } from './extensions'
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

  // system 主题下实时跟随系统深浅色偏好
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setPrefersDark(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)

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
        ...buildStaticExtensions(),
        themeCompartment.of(buildThemeExtensions(isDark, fontSize)),
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

  // 主题或字号变化时动态 reconfigure（不重建编辑器，保留撤销历史与光标）
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.reconfigure(buildThemeExtensions(isDark, fontSize)),
    })
  }, [fontSize, isDark])

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />
}
