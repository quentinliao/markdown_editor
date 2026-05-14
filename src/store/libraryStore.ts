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
  loadLibraries: () => Promise<void>
  addLibrary: (name: string, path: string) => Promise<void>
  removeLibrary: (id: number) => Promise<void>
  loadFileTree: (id: number, path: string) => Promise<void>
  toggleLibrary: (id: number) => void
  search: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  indexDocument: (libraryId: number, path: string) => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  libraries: [],
  fileTrees: {},
  searchResults: [],
  searchQuery: '',
  expandedLibraries: new Set(),

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

  loadFileTree: async (id: number, path: string) => {
    const nodes = await invoke<FileNode[]>('read_directory', { path })
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
}))
