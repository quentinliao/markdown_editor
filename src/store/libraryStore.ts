import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

export interface Library {
  id: number
  name: string
  path: string
}

export interface FileNode {
  name: string
  path: string
  is_dir: boolean
  children: FileNode[]
}

export interface SearchResult {
  id: number
  path: string
  title: string
  snippet: string
}

interface LibraryState {
  libraries: Library[]
  fileTrees: Record<number, FileNode[]>
  searchResults: SearchResult[]
  searchQuery: string
  expandedLibraries: Set<number>
  /** 当前需要定位的文件路径（由 FilePathBar 靶心设置，FileTreeNode 读取并自动展开祖先） */
  locateTargetPath: string | null
  loadLibraries: () => Promise<void>
  addLibrary: (name: string, path: string) => Promise<void>
  removeLibrary: (id: number) => Promise<void>
  /** 确保指定路径已是文档库（已存在则跳过，不存在则添加），返回匹配或新建的 Library */
  ensureLibrary: (name: string, path: string) => Promise<Library>
  loadFileTree: (id: number, path: string) => Promise<void>
  refreshFileTree: (id: number) => Promise<void>
  toggleLibrary: (id: number) => void
  search: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  indexDocument: (libraryId: number, path: string) => Promise<void>
  /** 设置定位目标路径，FileTreeNode 会响应并展开祖先链 */
  setLocateTargetPath: (path: string | null) => void
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  libraries: [],
  fileTrees: {},
  searchResults: [],
  searchQuery: '',
  expandedLibraries: new Set(),
  locateTargetPath: null,

  loadLibraries: async () => {
    const libraries = await invoke<Library[]>('get_libraries')
    set({ libraries })
  },

  addLibrary: async (name: string, path: string) => {
    await invoke('add_library', { name, path })
    await get().loadLibraries()
  },

  removeLibrary: async (id: number) => {
    await invoke('remove_library', { id })
    await get().loadLibraries()
  },

  ensureLibrary: async (name: string, path: string): Promise<Library> => {
    const { libraries } = get()
    // 检查是否已存在相同路径的库（精确匹配或路径是已有库的子路径）
    const existing = libraries.find((lib) => lib.path === path)
    if (existing) return existing
    // 不存在 → 新增
    await invoke('add_library', { name, path })
    await get().loadLibraries()
    return get().libraries.find((lib) => lib.path === path)!
  },

  loadFileTree: async (id: number, path: string) => {
    const nodes = await invoke<FileNode[]>('read_directory', { path })
    set((state) => ({
      fileTrees: { ...state.fileTrees, [id]: nodes },
    }))
  },

  refreshFileTree: async (id: number) => {
    const lib = get().libraries.find((l) => l.id === id)
    if (!lib) return
    const nodes = await invoke<FileNode[]>('read_directory', { path: lib.path })
    set((state) => ({
      fileTrees: { ...state.fileTrees, [id]: nodes },
    }))
  },

  toggleLibrary: (id: number) => {
    set((state) => {
      const next = new Set(state.expandedLibraries)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        const lib = state.libraries.find((l) => l.id === id)
        if (lib && !state.fileTrees[id]) {
          get().loadFileTree(id, lib.path)
        }
      }
      return { expandedLibraries: next }
    })
  },

  search: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: query })
      return
    }
    const results = await invoke<SearchResult[]>('search_documents', { query })
    set({ searchResults: results, searchQuery: query })
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  indexDocument: async (libraryId: number, path: string) => {
    await invoke('index_document', { libraryId, path })
  },

  setLocateTargetPath: (path) => set({ locateTargetPath: path }),
}))
