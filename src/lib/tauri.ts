import { invoke } from '@tauri-apps/api/core'

export const fileOps = {
  readFile: (path: string) => invoke<string>('read_file', { path }),
  writeFile: (path: string, content: string) => invoke<void>('write_file', { path, content }),
  fileExists: (path: string) => invoke<boolean>('file_exists', { path }),
  saveImage: (path: string, data: string) => invoke<void>('save_image', { path, data }),
  renameFile: (oldPath: string, newPath: string) => invoke<void>('rename_file', { oldPath, newPath }),
  deletePath: (path: string) => invoke<void>('delete_path', { path }),
  createFile: (path: string) => invoke<void>('create_file', { path }),
  createDirectory: (path: string) => invoke<void>('create_directory', { path }),
}
