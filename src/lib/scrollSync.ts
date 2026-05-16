/**
 * 滚动同步工具 — 绕过 React 状态，直接操作 DOM。
 *
 * 核心思路：
 * - 编辑器和预览区各自注册 scroll 事件监听
 * - 当 A 用户滚动时，设置 syncingSource='A' 并同步 B
 * - B 的 scroll 事件触发时，检测到 syncingSource='A'，只做确认并清锁，不同步回去
 * - 这样彻底避免反馈循环，且不影响连续滚动
 */

type ScrollSource = 'editor' | 'preview'

let editorDom: HTMLElement | null = null
let previewDom: HTMLElement | null = null

/** 同步锁：谁发起了本次同步 */
let syncingSource: ScrollSource | null = null

export function registerEditor(dom: HTMLElement) {
  editorDom = dom
  dom.addEventListener('scroll', onEditorScroll, { passive: true })
}

export function registerPreview(dom: HTMLElement) {
  previewDom = dom
  dom.addEventListener('scroll', onPreviewScroll, { passive: true })
}

export function unregisterEditor(dom: HTMLElement) {
  if (editorDom === dom) editorDom = null
  dom.removeEventListener('scroll', onEditorScroll)
}

export function unregisterPreview(dom: HTMLElement) {
  if (previewDom === dom) previewDom = null
  dom.removeEventListener('scroll', onPreviewScroll)
}

function onEditorScroll() {
  if (syncingSource === 'preview') {
    // 这是对侧同步过来的滚动，确认并清锁，不同步回去
    syncingSource = null
    return
  }
  // 用户主动滚动编辑器 → 同步预览区
  if (!editorDom || !previewDom) return
  const ratio = getScrollRatio(editorDom)
  if (ratio === null) return
  syncingSource = 'editor'
  setScrollRatio(previewDom, ratio)
}

function onPreviewScroll() {
  if (syncingSource === 'editor') {
    // 这是对侧同步过来的滚动，确认并清锁，不同步回去
    syncingSource = null
    return
  }
  // 用户主动滚动预览区 → 同步编辑器
  if (!editorDom || !previewDom) return
  const ratio = getScrollRatio(previewDom)
  if (ratio === null) return
  syncingSource = 'preview'
  setScrollRatio(editorDom, ratio)
}

function getScrollRatio(dom: HTMLElement): number | null {
  const maxScroll = dom.scrollHeight - dom.clientHeight
  if (maxScroll <= 0) return null
  return dom.scrollTop / maxScroll
}

function setScrollRatio(dom: HTMLElement, ratio: number) {
  const maxScroll = dom.scrollHeight - dom.clientHeight
  if (maxScroll <= 0) return
  dom.scrollTop = ratio * maxScroll
}
