# Markdown Preview — 设计文档

**日期：** 2026-05-14  
**目标：** 使用 Rust + Tauri 开发跨平台（macOS + Windows）Markdown 工具，功能对标 MWeb Pro，集成 AI 写作助手

---

## 一、整体架构

```
Markdown_Preview/
├── src-tauri/          # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/   # Tauri 命令（文件读写、搜索、元数据）
│   │   ├── db/         # SQLite 操作（sqlx + FTS5）
│   │   └── watcher/    # 文件系统监听（notify）
│   └── Cargo.toml
├── src/                # 前端（TypeScript + React）
│   ├── components/
│   │   ├── Sidebar/    # 文档库树形导航
│   │   ├── AiChat/     # AI Chat 面板
│   │   ├── Editor/     # CodeMirror 6 编辑器
│   │   └── Preview/    # Markdown 实时预览
│   ├── store/          # 状态管理（Zustand）
│   └── main.tsx
└── package.json
```

**核心分层：**
- **Rust 层**：文件 I/O、SQLite 索引（全文搜索、标签、元数据）、文件系统监听、API Key 加密存储
- **前端层**：编辑器 UI、预览渲染、侧边栏导航、AI Chat 面板
- **通信**：Tauri `invoke` 命令桥接前后端

---

## 二、核心功能模块

### 1. 文档库管理
- 支持添加多个本地文件夹作为"文档库"
- 树形目录展示（文件夹 + `.md` 文件）
- SQLite 存储：文件路径、标题、标签、字数、创建/修改时间
- `notify` crate 监听文件变化，自动更新索引

### 2. 编辑器（CodeMirror 6）
- Markdown 语法高亮
- 实时分栏预览（编辑左 / 预览右，可切换纯编辑 / 纯预览 / 分栏）
- 快捷键：加粗、斜体、插入链接、插入图片、标题级别
- 图片支持：拖拽/粘贴自动复制到 `assets/` 文件夹并插入路径
- 自动保存（防抖 500ms）

### 3. 全文搜索
- SQLite FTS5 全文搜索，搜索结果高亮关键词
- 支持按标签筛选

### 4. 导出
- 导出 PDF（调用系统打印或 headless WebView 渲染）
- 导出 HTML（带样式）
- 复制富文本到剪贴板（用于粘贴到邮件/文档）

---

## 三、UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│  工具栏（新建、搜索、导出、视图切换）                              │
├──────────┬───────────┬──────────────────┬───────────────────┤
│          │           │                  │                   │
│  侧边栏   │  AI Chat  │    编辑区          │    预览区          │
│          │           │                  │                   │
│ • 文档库1 │ [模型选择]  │  # 标题           │  渲染后的 Markdown │
│   ├ 文件  │ ─────────  │                  │                   │
│   └ 文件  │ 对话历史    │  正文内容...       │                   │
│ • 文档库2 │           │                  │                   │
│          │ [输入框]    │                  │                   │
│ [标签列表] │ [发送][插入]│                  │                   │
├──────────┴───────────┴──────────────────┴───────────────────┤
│  状态栏（字数、行数、文件路径）                                   │
└─────────────────────────────────────────────────────────────┘
```

**视图模式：**
- 四栏（默认）/ 仅编辑 / 仅预览 / 隐藏 AI 面板，快捷键切换
- 侧边栏、AI 面板、预览区均可独立折叠
- 深色 / 浅色主题跟随系统
- 预览主题：支持多套 CSS 主题（GitHub 风格、优雅衬线等）
- 字体设置：编辑区等宽字体，预览区衬线/无衬线可配置

---

## 四、AI Chat 面板

### 功能
- **上下文注入**：自动将当前文档全文（或选中段落）作为系统 prompt 的上下文传给 AI
- **快捷指令**：内置常用操作按钮——续写、润色、摘要、翻译、扩写
- **一键插入**：AI 回复可以「插入光标处」或「替换选中内容」
- **流式输出**：支持 SSE 流式响应，边生成边显示
- **面板可折叠**：不用时收起不占空间

### API 配置（设置页）
- Base URL（如 `https://api.minimax.chat/v1`）
- API Key（本地加密存储，Tauri `keyring` crate）
- 模型名称（自由填写）
- 兼容任何 OpenAI Chat Completion 协议的服务（Claude、Minimax、DeepSeek 等）

---

## 五、技术栈

### Rust 后端（src-tauri）

| 用途 | crate |
|------|-------|
| 数据库 | `sqlx` + SQLite（异步，FTS5 全文搜索）|
| 文件监听 | `notify` |
| Markdown 解析（备用）| `pulldown-cmark` |
| 序列化 | `serde` + `serde_json` |
| API Key 加密存储 | `keyring` |

### 前端

| 用途 | 库 |
|------|-----|
| 框架 | React 18 + TypeScript |
| 编辑器 | CodeMirror 6 + `@codemirror/lang-markdown` |
| Markdown 渲染 | `markdown-it`（表格、footnote、数学公式扩展）|
| 数学公式 | KaTeX |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS |
| 图标 | Lucide React |

### 构建
- Tauri 2.x（macOS + Windows 原生打包）
- Vite 前端构建器

---

## 六、开发优先级

| 阶段 | 内容 |
|------|------|
| P0 | Tauri 项目初始化、文件读写命令、基础编辑器 + 预览 |
| P1 | 文档库管理、SQLite 索引、文件监听、全文搜索 |
| P2 | AI Chat 面板、API 配置、流式输出 |
| P3 | 导出功能（PDF/HTML）、主题切换、快捷键完善 |
