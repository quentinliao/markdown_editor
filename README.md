# Markdown Preview

A cross-platform Markdown editor with live preview, built with **Tauri 2** + **React** + **Rust**.

[English](#features) | [中文](#功能特性)

## Features

### Editor
- **CodeMirror 6** powered editor with syntax highlighting
- Configurable font size and color scheme (light / dark / system theme)
- Smart paste: paste images (save to `assets/`), HTML tables, and TSV (Excel) auto-convert to Markdown
- Drag & drop `.md` files to open
- Auto-save every 5 seconds (persist temp files across sessions)
- Restore last opened file on launch

### Preview
- Real-time preview with scroll sync
- **Math / LaTeX** — KaTeX rendering (`$inline$` and `$$block$$`)
- **Code highlighting** — highlight.js with 17+ languages (GitHub-style theme)
- **Diagrams & Charts**
  - Mermaid (flowchart, sequence, class, state, gantt, pie, mindmap, etc.)
  - Sequence diagrams (` ```sequence ` — js-sequence-diagrams syntax)
  - Flowcharts (` ```flow ` / ` ```flowchart ` — flowchart.js syntax)
  - Mindmaps (` ```mindmap `)
  - Interactive maps — GeoJSON & TopoJSON (Leaflet + OpenStreetMap)
  - 3D models — STL (Three.js with grid, axes, and orbit controls)
  - Data charts — Pie, Line, Bar, Column (` ```chart ` — Yinxiang/Evernote syntax)
- Hyperlinks open in system browser, anchor links scroll in-page
- Selection toolbar for quick formatting

### Document Library
- Add folders as document libraries (native folder picker)
- Recursive file tree with expand/collapse
- Active file highlighting, right-click context menu (new file/folder, rename, delete)
- Crosshair locator — click to expand and scroll to current file in sidebar
- Drag files from system file manager to open and auto-add to library

### Export & Sharing
- Export to HTML / PNG / JPEG
- Copy as image to clipboard
- Copy as Markdown / HTML
- Print / PDF

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://www.rust-lang.org/tools/install) ≥ 1.70
- [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/your-username/markdown-preview.git
cd markdown-preview

# Install frontend dependencies
npm install

# Start development server
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2 (Rust) |
| Frontend | React 18, TypeScript, Vite |
| Editor | CodeMirror 6 |
| Styling | Tailwind CSS, @tailwindcss/typography |
| State | Zustand |
| Math | KaTeX |
| Code Highlight | highlight.js |
| Diagrams | Mermaid 11 |
| Maps | Leaflet, OpenStreetMap |
| 3D | Three.js |
| Charts | Chart.js |

## License

[MIT](./LICENSE)

---

# Markdown Preview

跨平台 Markdown 编辑器，基于 **Tauri 2** + **React** + **Rust** 构建。

## 功能特性

### 编辑器
- 基于 **CodeMirror 6** 的编辑器，支持语法高亮
- 可配置字号、配色方案（浅色 / 深色 / 跟随系统）
- 智能粘贴：粘贴图片（自动保存到 `assets/`）、HTML 表格、TSV（Excel）自动转为 Markdown
- 拖拽 `.md` 文件直接打开
- 每 5 秒自动保存，临时文件跨会话持久化
- 启动时自动恢复上次打开的文件

### 预览
- 实时预览，双向滚动同步
- **数学公式** — KaTeX 渲染（`$行内$` 和 `$$块级$$`）
- **代码高亮** — highlight.js，支持 17+ 语言（GitHub 风格主题）
- **图表与可视化**
  - Mermaid（流程图、序列图、类图、状态图、甘特图、饼图、思维导图等）
  - 序列图（` ```sequence ` — js-sequence-diagrams 语法）
  - 流程图（` ```flow ` / ` ```flowchart ` — flowchart.js 语法）
  - 思维导图（` ```mindmap `）
  - 交互式地图 — GeoJSON & TopoJSON（Leaflet + OpenStreetMap）
  - 3D 模型 — STL（Three.js 渲染，带网格、坐标轴、轨道控制）
  - 数据图表 — 饼图、折线图、柱状图、条形图（` ```chart ` — 印象笔记语法）
- 超链接在系统浏览器打开，锚点链接页内滚动
- 选中文本快速格式化工具栏

### 文档库
- 添加文件夹作为文档库（原生文件夹选择器）
- 递归文件树，支持展开/折叠
- 当前文件高亮，右键菜单（新建文件/文件夹、重命名、删除）
- 靶心定位按钮 — 点击展开并滚动到侧边栏中的当前文件
- 从系统文件管理器拖拽文件打开并自动添加到文档库

### 导出与分享
- 导出为 HTML / PNG / JPEG
- 复制为图片到剪贴板
- 复制为 Markdown / HTML
- 打印 / PDF

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 18
- [Rust](https://www.rust-lang.org/tools/install) ≥ 1.70
- [Tauri 2 CLI](https://v2.tauri.app/start/prerequisites/)

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/your-username/markdown-preview.git
cd markdown-preview

# 安装前端依赖
npm install

# 启动开发服务器
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

安装包在 `src-tauri/target/release/bundle/` 目录下。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 (Rust) |
| 前端 | React 18, TypeScript, Vite |
| 编辑器 | CodeMirror 6 |
| 样式 | Tailwind CSS, @tailwindcss/typography |
| 状态管理 | Zustand |
| 数学公式 | KaTeX |
| 代码高亮 | highlight.js |
| 图表 | Mermaid 11 |
| 地图 | Leaflet, OpenStreetMap |
| 3D 渲染 | Three.js |
| 数据图表 | Chart.js |

## 开源协议

[MIT](./LICENSE)
