# Markdown Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 Tauri 2.x + React + TypeScript 构建跨平台（macOS + Windows）Markdown 编辑器，功能对标 MWeb Pro，集成 AI 写作助手。

**Architecture:** Rust 后端处理文件 I/O、SQLite 索引（FTS5 全文搜索）和文件系统监听；React 前端提供四栏布局（侧边栏 / AI Chat / 编辑器 / 预览）；Tauri invoke 命令桥接前后端通信。

**Tech Stack:** Tauri 2.x, React 18, TypeScript, CodeMirror 6, markdown-it, KaTeX, Zustand, Tailwind CSS, sqlx + SQLite FTS5, notify, keyring

---

## P0：项目初始化 & 核心编辑流程

### Task 1: 初始化 Tauri + React + TypeScript 项目

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `index.html`

**Step 1: 安装 Tauri CLI 并创建项目**

```bash
cargo install tauri-cli
npm create tauri-app@latest . -- --template react-ts
```

预期输出：项目骨架生成，包含 `src-tauri/` 和 `src/` 目录。

**Step 2: 安装前端依赖**

```bash
npm install
npm install @codemirror/lang-markdown @codemirror/state @codemirror/view
npm install @codemirror/commands @codemirror/language @codemirror/theme-one-dark
npm install markdown-it katex markdown-it-katex
npm install @types/markdown-it @types/katex
npm install zustand
npm install lucide-react
npm install tailwindcss @tailwindcss/typography autoprefixer postcss
npm install -D @types/node
```

**Step 3: 配置 Tailwind CSS**

创建 `tailwind.config.js`：
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [require('@tailwindcss/typography')],
}
```

创建 `postcss.config.js`：
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

**Step 4: 添加 Rust 依赖**

编辑 `src-tauri/Cargo.toml`，在 `[dependencies]` 下添加：
```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.7", features = ["runtime-tokio-rustls", "sqlite"] }
notify = "6"
keyring = "2"
tokio = { version = "1", features = ["full"] }
pulldown-cmark = "0.9"
```

**Step 5: 验证项目可以启动**

```bash
npm run tauri dev
```

预期：窗口打开，显示默认 React 页面。

**Step 6: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Tauri + React + TypeScript project"
```

---

### Task 2: 实现基础四栏布局

**Files:**
- Create: `src/components/Layout/AppLayout.tsx`
- Create: `src/components/Layout/Toolbar.tsx`
- Create: `src/components/Layout/StatusBar.tsx`
- Create: `src/store/uiStore.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Step 1: 创建 UI 状态 store**

创建 `src/store/uiStore.ts`：
```typescript
import { create } from 'zustand'

type ViewMode = 'full' | 'editor-only' | 'preview-only' | 'no-ai'

interface UIState {
  viewMode: ViewMode
  sidebarWidth: number
  aiPanelWidth: number
  setViewMode: (mode: ViewMode) => void
  setSidebarWidth: (w: number) => void
  setAiPanelWidth: (w: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'full',
  sidebarWidth: 220,
  aiPanelWidth: 280,
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
  setAiPanelWidth: (w) => set({ aiPanelWidth: w }),
}))
```

**Step 2: 创建 Toolbar 组件**

创建 `src/components/Layout/Toolbar.tsx`：
```tsx
import { FileText, Search, Download, Columns2, AlignJustify } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

export function Toolbar() {
  const { viewMode, setViewMode } = useUIStore()
  return (
    <div className="h-10 flex items-center gap-2 px-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="新建文档">
        <FileText size={16} />
      </button>
      <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="搜索">
        <Search size={16} />
      </button>
      <div className="flex-1" />
      <button className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700" title="导出">
        <Download size={16} />
      </button>
      <button
        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        title="切换视图"
        onClick={() => setViewMode(viewMode === 'full' ? 'editor-only' : 'full')}
      >
        <Columns2 size={16} />
      </button>
    </div>
  )
}
```

**Step 3: 创建 StatusBar 组件**

创建 `src/components/Layout/StatusBar.tsx`：
```tsx
interface StatusBarProps {
  wordCount: number
  lineCount: number
  filePath?: string
}

export function StatusBar({ wordCount, lineCount, filePath }: StatusBarProps) {
  return (
    <div className="h-6 flex items-center gap-4 px-3 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <span>{wordCount} 字</span>
      <span>第 {lineCount} 行</span>
      {filePath && <span className="truncate">{filePath}</span>}
    </div>
  )
}
```

**Step 4: 创建 AppLayout 组件**

创建 `src/components/Layout/AppLayout.tsx`：
```tsx
import { ReactNode } from 'react'
import { Toolbar } from './Toolbar'
import { StatusBar } from './StatusBar'
import { useUIStore } from '../../store/uiStore'

interface AppLayoutProps {
  sidebar: ReactNode
  aiChat: ReactNode
  editor: ReactNode
  preview: ReactNode
  statusProps: { wordCount: number; lineCount: number; filePath?: string }
}

export function AppLayout({ sidebar, aiChat, editor, preview, statusProps }: AppLayoutProps) {
  const { viewMode, sidebarWidth, aiPanelWidth } = useUIStore()
  const showAi = viewMode === 'full'
  const showPreview = viewMode === 'full' || viewMode === 'no-ai' || viewMode === 'preview-only'
  const showEditor = viewMode !== 'preview-only'

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: sidebarWidth }} className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {sidebar}
        </div>
        {showAi && (
          <div style={{ width: aiPanelWidth }} className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            {aiChat}
          </div>
        )}
        {showEditor && (
          <div className="flex-1 min-w-0 overflow-hidden">
            {editor}
          </div>
        )}
        {showPreview && (
          <div className="flex-1 min-w-0 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            {preview}
          </div>
        )}
      </div>
      <StatusBar {...statusProps} />
    </div>
  )
}
```

**Step 5: 更新 App.tsx**

```tsx
import { AppLayout } from './components/Layout/AppLayout'

function App() {
  return (
    <AppLayout
      sidebar={<div className="p-3 text-sm text-gray-500">侧边栏（待实现）</div>}
      aiChat={<div className="p-3 text-sm text-gray-500">AI Chat（待实现）</div>}
      editor={<div className="p-3 text-sm text-gray-500">编辑器（待实现）</div>}
      preview={<div className="p-3 text-sm text-gray-500">预览（待实现）</div>}
      statusProps={{ wordCount: 0, lineCount: 1 }}
    />
  )
}

export default App
```

**Step 6: 验证布局渲染正确**

```bash
npm run tauri dev
```

预期：四栏布局正确显示，Toolbar 和 StatusBar 在顶部和底部。

**Step 7: Commit**

```bash
git add src/
git commit -m "feat: add four-panel layout with toolbar and status bar"
```

---

### Task 3: 实现 CodeMirror 6 Markdown 编辑器

**Files:**
- Create: `src/components/Editor/MarkdownEditor.tsx`
- Create: `src/components/Editor/extensions.ts`
- Create: `src/store/editorStore.ts`

**Step 1: 创建编辑器状态 store**

创建 `src/store/editorStore.ts`：
```typescript
import { create } from 'zustand'

interface EditorState {
  content: string
  filePath: string | null
  isDirty: boolean
  cursorLine: number
  setContent: (content: string) => void
  setFilePath: (path: string | null) => void
  setDirty: (dirty: boolean) => void
  setCursorLine: (line: number) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '# 欢迎使用 Markdown Preview\n\n开始写作...',
  filePath: null,
  isDirty: false,
  cursorLine: 1,
  setContent: (content) => set({ content, isDirty: true }),
  setFilePath: (filePath) => set({ filePath }),
  setDirty: (isDirty) => set({ isDirty }),
  setCursorLine: (cursorLine) => set({ cursorLine }),
}))
```

**Step 2: 创建 CodeMirror 扩展配置**

创建 `src/components/Editor/extensions.ts`：
```typescript
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap, EditorView } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { lineNumbers, highlightActiveLine } from '@codemirror/view'
import { bracketMatching } from '@codemirror/language'

export const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: '"JetBrains Mono", "Fira Code", monospace' },
  '.cm-content': { padding: '12px 16px' },
})

export function buildExtensions(isDark: boolean) {
  return [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    bracketMatching(),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    baseTheme,
    ...(isDark ? [oneDark] : []),
  ]
}
```

**Step 3: 创建 MarkdownEditor 组件**

创建 `src/components/Editor/MarkdownEditor.tsx`：
```tsx
import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { buildExtensions } from './extensions'
import { useEditorStore } from '../../store/editorStore'

let saveTimer: ReturnType<typeof setTimeout>

export function MarkdownEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { content, setContent, setCursorLine } = useEditorStore()

  const handleChange = useCallback((value: string) => {
    setContent(value)
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      // 自动保存逻辑（Task 7 实现）
    }, 500)
  }, [setContent])

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
    return () => view.destroy()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="h-full w-full" />
}
```

**Step 4: 集成到 App.tsx**

在 `App.tsx` 中替换 editor 占位符：
```tsx
import { MarkdownEditor } from './components/Editor/MarkdownEditor'
// editor prop 改为：
editor={<MarkdownEditor />}
```

**Step 5: 验证编辑器工作正常**

```bash
npm run tauri dev
```

预期：编辑区显示 CodeMirror 编辑器，可以输入 Markdown 文本，语法高亮正常。

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add CodeMirror 6 Markdown editor with syntax highlighting"
```

---

### Task 4: 实现 Markdown 实时预览

**Files:**
- Create: `src/components/Preview/MarkdownPreview.tsx`
- Create: `src/components/Preview/preview.css`

**Step 1: 安装 markdown-it 插件**

```bash
npm install markdown-it-anchor markdown-it-toc-done-right
```

**Step 2: 创建预览组件**

创建 `src/components/Preview/MarkdownPreview.tsx`：
```tsx
import { useMemo } from 'react'
import MarkdownIt from 'markdown-it'
import 'katex/dist/katex.min.css'
import './preview.css'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

interface MarkdownPreviewProps {
  content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const html = useMemo(() => md.render(content), [content])
  return (
    <div
      className="prose prose-gray dark:prose-invert max-w-none p-6 h-full overflow-y-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

**Step 3: 创建预览样式**

创建 `src/components/Preview/preview.css`：
```css
.prose pre {
  background: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
}
.prose code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875em;
}
.prose table {
  border-collapse: collapse;
  width: 100%;
}
.prose th, .prose td {
  border: 1px solid #d0d7de;
  padding: 6px 13px;
}
```

**Step 4: 连接编辑器内容到预览**

修改 `src/App.tsx`：
```tsx
import { MarkdownPreview } from './components/Preview/MarkdownPreview'
import { useEditorStore } from './store/editorStore'

function App() {
  const { content, cursorLine } = useEditorStore()
  return (
    <AppLayout
      // ...
      preview={<MarkdownPreview content={content} />}
      statusProps={{ wordCount: content.length, lineCount: cursorLine }}
    />
  )
}
```

**Step 5: 验证实时预览**

```bash
npm run tauri dev
```

预期：编辑器输入内容，右侧预览实时更新渲染结果。

**Step 6: Commit**

```bash
git add src/
git commit -m "feat: add real-time Markdown preview with markdown-it"
```

---

### Task 5: 实现文件读写 Tauri 命令

**Files:**
- Create: `src-tauri/src/commands/file_ops.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src/lib/tauri.ts`

**Step 1: 创建文件操作命令**

创建 `src-tauri/src/commands/file_ops.rs`：
```rust
use std::fs;
use std::path::Path;
use tauri::command;

#[command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[command]
pub fn file_exists(path: String) -> bool {
    Path::new(&path).exists()
}
```

**Step 2: 注册命令到 main.rs**

修改 `src-tauri/src/main.rs`：
```rust
mod commands;
use commands::file_ops::*;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            file_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: 创建前端 Tauri 调用封装**

创建 `src/lib/tauri.ts`：
```typescript
import { invoke } from '@tauri-apps/api/core'

export const fileOps = {
  readFile: (path: string) => invoke<string>('read_file', { path }),
  writeFile: (path: string, content: string) => invoke<void>('write_file', { path, content }),
  fileExists: (path: string) => invoke<boolean>('file_exists', { path }),
}
```

**Step 4: 在编辑器中实现自动保存**

修改 `src/components/Editor/MarkdownEditor.tsx`，在自动保存回调中调用：
```typescript
import { fileOps } from '../../lib/tauri'
import { useEditorStore } from '../../store/editorStore'

// 在 handleChange 的 setTimeout 中：
saveTimer = setTimeout(async () => {
  const { filePath, content, setDirty } = useEditorStore.getState()
  if (filePath) {
    await fileOps.writeFile(filePath, content)
    setDirty(false)
  }
}, 500)
```

**Step 5: 添加新建/打开文件功能**

修改 `src/components/Layout/Toolbar.tsx`，实现新建按钮：
```typescript
import { open, save } from '@tauri-apps/plugin-dialog'
import { fileOps } from '../../lib/tauri'
import { useEditorStore } from '../../store/editorStore'

// 新建文档
const handleNew = async () => {
  const path = await save({ filters: [{ name: 'Markdown', extensions: ['md'] }] })
  if (path) {
    await fileOps.writeFile(path, '# 新文档\n\n')
    useEditorStore.getState().setFilePath(path)
    useEditorStore.getState().setContent('# 新文档\n\n')
  }
}
```

**Step 6: 安装 dialog 插件**

```bash
npm install @tauri-apps/plugin-dialog
cargo add tauri-plugin-dialog --manifest-path src-tauri/Cargo.toml
```

在 `main.rs` 添加：`.plugin(tauri_plugin_dialog::init())`

**Step 7: 验证文件读写**

```bash
npm run tauri dev
```

预期：点击新建，选择保存路径，编辑后自动保存到文件。

**Step 8: Commit**

```bash
git add src/ src-tauri/
git commit -m "feat: add file read/write Tauri commands with auto-save"
```

---

## P1：文档库管理 & 全文搜索

### Task 6: 初始化 SQLite 数据库

**Files:**
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/schema.sql`
- Modify: `src-tauri/src/main.rs`

**Step 1: 创建数据库 schema**

创建 `src-tauri/src/db/schema.sql`：
```sql
CREATE TABLE IF NOT EXISTS libraries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    tags TEXT DEFAULT '',
    word_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    title,
    content,
    content=documents,
    content_rowid=id
);
```

**Step 2: 创建数据库模块**

创建 `src-tauri/src/db/mod.rs`：
```rust
use sqlx::{sqlite::SqlitePool, Pool, Sqlite};
use std::fs;
use tauri::AppHandle;

pub type DbPool = Pool<Sqlite>;

pub async fn init_db(app: &AppHandle) -> Result<DbPool, sqlx::Error> {
    let app_dir = app.path().app_data_dir().expect("no app data dir");
    fs::create_dir_all(&app_dir).ok();
    let db_path = app_dir.join("markdown_preview.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    let pool = SqlitePool::connect(&db_url).await?;
    sqlx::query(include_str!("schema.sql"))
        .execute(&pool)
        .await?;
    Ok(pool)
}
```

**Step 3: 注入 pool 到 Tauri state**

修改 `src-tauri/src/main.rs`：
```rust
mod db;
use db::init_db;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(init_db(app.handle()))?;
            app.manage(pool);
            Ok(())
        })
        // ...
}
```

**Step 4: 验证数据库初始化**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

预期：编译通过，无错误。

**Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat: initialize SQLite database with FTS5 schema"
```

---

### Task 7: 文档库管理命令

**Files:**
- Create: `src-tauri/src/commands/library.rs`
- Create: `src/store/libraryStore.ts`
- Create: `src/components/Sidebar/Sidebar.tsx`
- Create: `src/components/Sidebar/LibraryTree.tsx`

**Step 1: 创建 library 数据结构**

创建 `src-tauri/src/commands/library.rs`：
```rust
use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use tauri::{command, State};
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Library {
    pub id: i64,
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

#[command]
pub async fn add_library(
    pool: State<'_, SqlitePool>,
    name: String,
    path: String,
) -> Result<Library, String> {
    let result = sqlx::query_as!(
        Library,
        "INSERT INTO libraries (name, path) VALUES (?, ?) RETURNING id, name, path",
        name, path
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(result)
}

#[command]
pub async fn get_libraries(pool: State<'_, SqlitePool>) -> Result<Vec<Library>, String> {
    sqlx::query_as!(Library, "SELECT id, name, path FROM libraries ORDER BY name")
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn remove_library(pool: State<'_, SqlitePool>, id: i64) -> Result<(), String> {
    sqlx::query!("DELETE FROM libraries WHERE id = ?", id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn read_directory(path: String) -> Result<Vec<FileNode>, String> {
    read_dir_recursive(&path, 0).map_err(|e| e.to_string())
}

fn read_dir_recursive(path: &str, depth: u8) -> std::io::Result<Vec<FileNode>> {
    if depth > 5 { return Ok(vec![]); }
    let mut nodes = vec![];
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue; }
        let entry_path = entry.path().to_string_lossy().to_string();
        let is_dir = entry.file_type()?.is_dir();
        let children = if is_dir {
            read_dir_recursive(&entry_path, depth + 1).unwrap_or_default()
        } else if !name.ends_with(".md") {
            continue;
        } else {
            vec![]
        };
        nodes.push(FileNode { name, path: entry_path, is_dir, children });
    }
    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });
    Ok(nodes)
}
```

**Step 2: 注册新命令**

修改 `src-tauri/src/main.rs` 添加 library 命令。

**Step 3: 创建 libraryStore**

创建 `src/store/libraryStore.ts`：
```typescript
import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

export interface FileNode {
  name: string
  path: string
  is_dir: boolean
  children: FileNode[]
}

export interface Library {
  id: number
  name: string
  path: string
}

interface LibraryState {
  libraries: Library[]
  fileTree: Record<number, FileNode[]>
  selectedFile: string | null
  loadLibraries: () => Promise<void>
  addLibrary: (name: string, path: string) => Promise<void>
  removeLibrary: (id: number) => Promise<void>
  loadFileTree: (libraryId: number, path: string) => Promise<void>
  selectFile: (path: string) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  libraries: [],
  fileTree: {},
  selectedFile: null,
  loadLibraries: async () => {
    const libraries = await invoke<Library[]>('get_libraries')
    set({ libraries })
  },
  addLibrary: async (name, path) => {
    await invoke('add_library', { name, path })
    get().loadLibraries()
  },
  removeLibrary: async (id) => {
    await invoke('remove_library', { id })
    get().loadLibraries()
  },
  loadFileTree: async (libraryId, path) => {
    const tree = await invoke<FileNode[]>('read_directory', { path })
    set((s) => ({ fileTree: { ...s.fileTree, [libraryId]: tree } }))
  },
  selectFile: (path) => set({ selectedFile: path }),
}))
```

**Step 4: 创建 Sidebar 组件**

创建 `src/components/Sidebar/LibraryTree.tsx`：
```tsx
import { useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react'
import { FileNode, useLibraryStore } from '../../store/libraryStore'
import { fileOps } from '../../lib/tauri'
import { useEditorStore } from '../../store/editorStore'

function FileItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2)
  const { selectFile } = useLibraryStore()
  const { setContent, setFilePath } = useEditorStore()

  const handleClick = async () => {
    if (node.is_dir) {
      setOpen(!open)
    } else {
      const content = await fileOps.readFile(node.path)
      setContent(content)
      setFilePath(node.path)
      selectFile(node.path)
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={handleClick}
      >
        {node.is_dir ? (
          open ? <ChevronDown size={12} /> : <ChevronRight size={12} />
        ) : <span className="w-3" />}
        {node.is_dir ? <Folder size={13} className="text-blue-400" /> : <FileText size={13} className="text-gray-400" />}
        <span className="truncate">{node.name}</span>
      </div>
      {node.is_dir && open && node.children.map((child) => (
        <FileItem key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function LibraryTree() {
  const { libraries, fileTree, loadFileTree } = useLibraryStore()

  return (
    <div>
      {libraries.map((lib) => (
        <div key={lib.id}>
          <div
            className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => loadFileTree(lib.id, lib.path)}
          >
            {lib.name}
          </div>
          {(fileTree[lib.id] || []).map((node) => (
            <FileItem key={node.path} node={node} />
          ))}
        </div>
      ))}
    </div>
  )
}
```

创建 `src/components/Sidebar/Sidebar.tsx`：
```tsx
import { useEffect } from 'react'
import { Plus } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { useLibraryStore } from '../../store/libraryStore'
import { LibraryTree } from './LibraryTree'

export function Sidebar() {
  const { loadLibraries, addLibrary } = useLibraryStore()

  useEffect(() => { loadLibraries() }, [loadLibraries])

  const handleAddLibrary = async () => {
    const dir = await open({ directory: true })
    if (dir) {
      const name = (dir as string).split('/').pop() || 'Library'
      await addLibrary(name, dir as string)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500">文档库</span>
        <button onClick={handleAddLibrary} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <LibraryTree />
      </div>
    </div>
  )
}
```

**Step 5: 集成 Sidebar 到 App.tsx**

```tsx
import { Sidebar } from './components/Sidebar/Sidebar'
// sidebar prop 改为：
sidebar={<Sidebar />}
```

**Step 6: 验证文档库功能**

```bash
npm run tauri dev
```

预期：点击"+"添加文件夹，侧边栏显示文件树，点击文件在编辑器中打开。

**Step 7: Commit**

```bash
git add src/ src-tauri/
git commit -m "feat: add library management with file tree sidebar"
```

---

### Task 8: 全文搜索

**Files:**
- Create: `src-tauri/src/commands/search.rs`
- Create: `src/components/Search/SearchPanel.tsx`
- Modify: `src/components/Layout/Toolbar.tsx`

**Step 1: 创建索引和搜索命令**

创建 `src-tauri/src/commands/search.rs`：
```rust
use sqlx::SqlitePool;
use serde::Serialize;
use tauri::{command, State};
use std::fs;

#[derive(Serialize)]
pub struct SearchResult {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub snippet: String,
}

#[command]
pub async fn index_document(
    pool: State<'_, SqlitePool>,
    library_id: i64,
    path: String,
) -> Result<(), String> {
    let content = fs::read_to_string(&path).unwrap_or_default();
    let title = content.lines()
        .find(|l| l.starts_with('#'))
        .map(|l| l.trim_start_matches('#').trim().to_string())
        .unwrap_or_else(|| path.split('/').last().unwrap_or("").replace(".md", ""));
    let word_count = content.chars().count() as i64;

    sqlx::query!(
        "INSERT OR REPLACE INTO documents (library_id, path, title, word_count) VALUES (?, ?, ?, ?)",
        library_id, path, title, word_count
    )
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query!(
        "INSERT OR REPLACE INTO documents_fts (rowid, title, content) \
         SELECT id, title, ? FROM documents WHERE path = ?",
        content, path
    )
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn search_documents(
    pool: State<'_, SqlitePool>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let results = sqlx::query_as!(
        SearchResult,
        "SELECT d.id, d.path, d.title, snippet(documents_fts, 1, '<mark>', '</mark>', '...', 20) AS snippet \
         FROM documents_fts f JOIN documents d ON f.rowid = d.id \
         WHERE documents_fts MATCH ? ORDER BY rank LIMIT 50",
        query
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(results)
}
```

**Step 2: 创建搜索面板组件**

创建 `src/components/Search/SearchPanel.tsx`：
```tsx
import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Search } from 'lucide-react'
import { fileOps } from '../../lib/tauri'
import { useEditorStore } from '../../store/editorStore'

interface SearchResult {
  id: number
  path: string
  title: string
  snippet: string
}

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const { setContent, setFilePath } = useEditorStore()

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    const res = await invoke<SearchResult[]>('search_documents', { query: q })
    setResults(res)
  }

  const handleOpen = async (path: string) => {
    const content = await fileOps.readFile(path)
    setContent(content)
    setFilePath(path)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 bg-black/30">
      <div className="w-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Search size={16} className="text-gray-400" />
          <input
            autoFocus
            className="flex-1 outline-none text-sm bg-transparent"
            placeholder="搜索文档..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button onClick={onClose} className="text-xs text-gray-400">ESC</button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {results.map((r) => (
            <div
              key={r.id}
              className="px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-0"
              onClick={() => handleOpen(r.path)}
            >
              <div className="font-medium text-sm">{r.title}</div>
              <div
                className="text-xs text-gray-500 mt-0.5"
                dangerouslySetInnerHTML={{ __html: r.snippet }}
              />
            </div>
          ))}
          {results.length === 0 && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">无搜索结果</div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 3: 在 Toolbar 中接入搜索**

在 `Toolbar.tsx` 添加搜索状态，点击搜索按钮显示 SearchPanel。

**Step 4: 验证全文搜索**

```bash
npm run tauri dev
```

预期：点击搜索按钮，输入关键词，显示匹配的文档，点击跳转到文档。

**Step 5: Commit**

```bash
git add src/ src-tauri/
git commit -m "feat: add FTS5 full-text search with result highlighting"
```

---

## P2：AI Chat 面板

### Task 9: AI Chat 面板 UI

**Files:**
- Create: `src/components/AiChat/AiChatPanel.tsx`
- Create: `src/components/AiChat/MessageList.tsx`
- Create: `src/components/AiChat/QuickActions.tsx`
- Create: `src/store/aiStore.ts`

**Step 1: 创建 AI 状态 store**

创建 `src/store/aiStore.ts`：
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

interface AiState {
  messages: Message[]
  config: AiConfig
  isStreaming: boolean
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  updateLastMessage: (content: string) => void
  clearMessages: () => void
  setConfig: (config: AiConfig) => void
  setStreaming: (v: boolean) => void
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      messages: [],
      config: { baseUrl: 'https://api.anthropic.com/v1', apiKey: '', model: 'claude-3-5-sonnet-20241022' },
      isStreaming: false,
      addMessage: (msg) => {
        const id = Date.now().toString()
        set((s) => ({ messages: [...s.messages, { ...msg, id, timestamp: Date.now() }] }))
        return id
      },
      updateLastMessage: (content) => set((s) => {
        const msgs = [...s.messages]
        if (msgs.length > 0) msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content }
        return { messages: msgs }
      }),
      clearMessages: () => set({ messages: [] }),
      setConfig: (config) => set({ config }),
      setStreaming: (isStreaming) => set({ isStreaming }),
    }),
    { name: 'ai-store', partialize: (s) => ({ config: s.config }) }
  )
)
```

**Step 2: 创建快捷操作按钮**

创建 `src/components/AiChat/QuickActions.tsx`：
```tsx
const ACTIONS = [
  { label: '续写', prompt: '请根据上下文继续写作' },
  { label: '润色', prompt: '请润色以下文字，使其更流畅自然' },
  { label: '摘要', prompt: '请为以下文档生成简洁摘要' },
  { label: '翻译', prompt: '请将以下内容翻译成英文' },
  { label: '扩写', prompt: '请对以下内容进行详细扩写' },
]

export function QuickActions({ onAction }: { onAction: (prompt: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-gray-700">
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.prompt)}
          className="px-2 py-0.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
```

**Step 3: 创建消息列表**

创建 `src/components/AiChat/MessageList.tsx`：
```tsx
import { Message } from '../../store/aiStore'

export function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
            msg.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
          }`}>
            {msg.content}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Step 4: 创建 AiChatPanel**

创建 `src/components/AiChat/AiChatPanel.tsx`：
```tsx
import { useState, useRef } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { useAiStore } from '../../store/aiStore'
import { useEditorStore } from '../../store/editorStore'
import { MessageList } from './MessageList'
import { QuickActions } from './QuickActions'
import { streamChat } from '../../lib/aiService'

export function AiChatPanel() {
  const [input, setInput] = useState('')
  const { messages, config, isStreaming, addMessage, updateLastMessage, clearMessages, setStreaming } = useAiStore()
  const { content: docContent, setContent } = useEditorStore()

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isStreaming) return
    setInput('')
    addMessage({ role: 'user', content: prompt })
    addMessage({ role: 'assistant', content: '' })
    setStreaming(true)

    try {
      const systemPrompt = `你是一个 Markdown 写作助手。以下是当前文档内容：\n\n${docContent}\n\n请根据用户的指令帮助改进或扩展这篇文档。`
      let accumulated = ''
      await streamChat(config, systemPrompt, [...messages, { id: '', role: 'user' as const, content: prompt, timestamp: 0 }], (chunk) => {
        accumulated += chunk
        updateLastMessage(accumulated)
      })
    } finally {
      setStreaming(false)
    }
  }

  const handleInsert = () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (lastAssistant) setContent(docContent + '\n\n' + lastAssistant.content)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500">AI 助手</span>
        <button onClick={clearMessages} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
          <Trash2 size={13} />
        </button>
      </div>
      <QuickActions onAction={(p) => sendMessage(p)} />
      <MessageList messages={messages} />
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
        <div className="flex gap-1">
          <textarea
            className="flex-1 text-xs border rounded p-1.5 resize-none bg-transparent dark:border-gray-600 focus:outline-none"
            rows={3}
            placeholder="输入消息..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming}
            className="self-end p-2 rounded bg-blue-500 text-white disabled:opacity-50"
          >
            <Send size={13} />
          </button>
        </div>
        <button onClick={handleInsert} className="w-full text-xs py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
          插入到文档
        </button>
      </div>
    </div>
  )
}
```

**Step 5: Commit（UI 骨架）**

```bash
git add src/
git commit -m "feat: add AI chat panel UI with message list and quick actions"
```

---

### Task 10: AI 流式请求服务

**Files:**
- Create: `src/lib/aiService.ts`
- Create: `src/components/AiChat/SettingsModal.tsx`

**Step 1: 创建 AI 流式服务**

创建 `src/lib/aiService.ts`：
```typescript
import { AiConfig, Message } from '../store/aiStore'

export async function streamChat(
  config: AiConfig,
  systemPrompt: string,
  messages: Message[],
  onChunk: (chunk: string) => void,
): Promise<void> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
          .filter((m) => m.content)
          .map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const data = JSON.parse(line.slice(6))
        const chunk = data.choices?.[0]?.delta?.content
        if (chunk) onChunk(chunk)
      } catch { /* skip malformed lines */ }
    }
  }
}
```

**Step 2: 创建设置弹窗**

创建 `src/components/AiChat/SettingsModal.tsx`：
```tsx
import { useState } from 'react'
import { useAiStore } from '../../store/aiStore'

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { config, setConfig } = useAiStore()
  const [form, setForm] = useState(config)

  const handleSave = () => {
    setConfig(form)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-5 space-y-4">
        <h3 className="font-semibold">AI 配置</h3>
        <div className="space-y-3">
          {([['Base URL', 'baseUrl'], ['API Key', 'apiKey'], ['模型', 'model']] as const).map(([label, key]) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <input
                type={key === 'apiKey' ? 'password' : 'text'}
                className="w-full border rounded px-3 py-1.5 text-sm bg-transparent dark:border-gray-600 focus:outline-none"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border">取消</button>
          <button onClick={handleSave} className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white">保存</button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: 集成 AiChatPanel 到 App.tsx**

```tsx
import { AiChatPanel } from './components/AiChat/AiChatPanel'
// aiChat prop 改为：
aiChat={<AiChatPanel />}
```

**Step 4: 验证 AI 流式输出**

配置有效的 API key，发送消息，预期：AI 回复逐字出现（流式）。

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: add AI streaming chat with OpenAI-compatible API support"
```

---

## P3：导出 & 主题

### Task 11: 导出功能

**Files:**
- Create: `src-tauri/src/commands/export.rs`
- Create: `src/components/Export/ExportMenu.tsx`

**Step 1: 创建导出命令（Rust）**

创建 `src-tauri/src/commands/export.rs`：
```rust
use tauri::{command, AppHandle};
use tauri::webview::WebviewWindowBuilder;

#[command]
pub async fn export_html(content: String, title: String) -> Result<String, String> {
    let html = format!(r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>body{{max-width:800px;margin:0 auto;padding:40px;font-family:sans-serif;line-height:1.6}}</style>
</head><body>{content}</body></html>"#);
    Ok(html)
}
```

**Step 2: 创建前端导出菜单**

创建 `src/components/Export/ExportMenu.tsx`：
```tsx
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { fileOps } from '../../lib/tauri'
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: true })

interface ExportMenuProps {
  content: string
  onClose: () => void
}

export function ExportMenu({ content, onClose }: ExportMenuProps) {
  const handleExportHtml = async () => {
    const html = await invoke<string>('export_html', {
      content: md.render(content),
      title: '导出文档',
    })
    const path = await save({ filters: [{ name: 'HTML', extensions: ['html'] }] })
    if (path) await fileOps.writeFile(path, html)
    onClose()
  }

  const handlePrint = () => {
    window.print()
    onClose()
  }

  return (
    <div className="absolute right-2 top-10 z-50 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700">
      <button onClick={handleExportHtml} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700">
        导出 HTML
      </button>
      <button onClick={handlePrint} className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700">
        打印 / 导出 PDF
      </button>
    </div>
  )
}
```

**Step 3: 集成导出按钮到 Toolbar**

修改 `Toolbar.tsx`，点击导出按钮显示 `ExportMenu`。

**Step 4: Commit**

```bash
git add src/ src-tauri/
git commit -m "feat: add HTML export and print-to-PDF functionality"
```

---

### Task 12: 深色/浅色主题切换

**Files:**
- Modify: `src/store/uiStore.ts`
- Modify: `src/components/Layout/Toolbar.tsx`
- Modify: `src/App.tsx`

**Step 1: 添加主题状态**

在 `uiStore.ts` 添加：
```typescript
theme: 'system' as 'light' | 'dark' | 'system',
setTheme: (theme: 'light' | 'dark' | 'system') => set({ theme }),
```

**Step 2: 在 App.tsx 应用主题**

```tsx
import { useEffect } from 'react'
import { useUIStore } from './store/uiStore'

function App() {
  const { theme } = useUIStore()
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme])
  // ...
}
```

**Step 3: 添加主题切换按钮**

在 `Toolbar.tsx` 添加 Moon/Sun 图标按钮。

**Step 4: 验证主题切换**

```bash
npm run tauri dev
```

预期：点击主题按钮，界面在深色/浅色之间切换。

**Step 5: Commit**

```bash
git add src/
git commit -m "feat: add dark/light theme toggle with system preference support"
```

---

## 验收标准

| 功能 | 验收条件 |
|------|---------|
| 编辑器 | Markdown 语法高亮，自动保存，无延迟 |
| 预览 | 实时渲染，支持表格/数学公式 |
| 文档库 | 添加文件夹，树形展示，点击打开文件 |
| 搜索 | 输入关键词 < 200ms 返回结果，高亮匹配 |
| AI Chat | 流式输出，快捷指令，一键插入文档 |
| 导出 | HTML 导出正常，打印 PDF 正常 |
| 主题 | 深色/浅色切换，跟随系统 |
| 跨平台 | macOS + Windows 打包成功，功能正常 |
