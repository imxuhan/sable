import { contextBridge, ipcRenderer } from 'electron'
import path from 'path'
import type {
  MenuCommand,
  MenuSyncState,
  SableBridgeAPI
} from '@shared/types'

function resolveAssetUrl(src: string, docPath: string | null): string {
  const trimmed = src.trim()
  if (!trimmed) return ''
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('sable-asset://')
  ) {
    return trimmed
  }

  let decoded = trimmed
  try {
    decoded = decodeURIComponent(trimmed)
  } catch {
    decoded = trimmed
  }

  let absolutePath: string
  if (path.isAbsolute(decoded) || /^[a-zA-Z]:[\\/]/.test(decoded)) {
    absolutePath = path.resolve(decoded)
  } else if (docPath) {
    absolutePath = path.resolve(path.dirname(docPath), decoded)
  } else {
    return trimmed
  }

  return `sable-asset://local/file?path=${encodeURIComponent(absolutePath)}`
}

const api: SableBridgeAPI = {
  openFileDialog: () => ipcRenderer.invoke('sable:open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('sable:open-folder-dialog'),
  readFile: (filePath) => ipcRenderer.invoke('sable:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('sable:write-file', filePath, content),
  saveFileAs: (content, defaultPath) =>
    ipcRenderer.invoke('sable:save-file-as', content, defaultPath),
  createEntry: (parentDir, name, isDirectory) =>
    ipcRenderer.invoke('sable:create-entry', parentDir, name, isDirectory),
  renameEntry: (oldPath, newPath) => ipcRenderer.invoke('sable:rename-entry', oldPath, newPath),
  deleteEntry: (targetPath) => ipcRenderer.invoke('sable:delete-entry', targetPath),
  readWorkspaceTree: (rootDir) => ipcRenderer.invoke('sable:read-workspace-tree', rootDir),
  searchWorkspace: (rootDir, query) => ipcRenderer.invoke('sable:search-workspace', rootDir, query),
  watchDocument: (filePath) => ipcRenderer.invoke('sable:watch-document', filePath),
  watchWorkspace: (rootDir) => ipcRenderer.invoke('sable:watch-workspace', rootDir),

  saveClipboardImage: (docPath, action, customDir) =>
    ipcRenderer.invoke('sable:save-clipboard-image', docPath, action, customDir),
  importImageFile: (sourcePath, docPath, action, customDir) =>
    ipcRenderer.invoke('sable:import-image-file', sourcePath, docPath, action, customDir),
  pickAndImportImage: (docPath, action, customDir) =>
    ipcRenderer.invoke('sable:pick-import-image', docPath, action, customDir),
  resolveAssetUrl,

  loadAppState: () => ipcRenderer.invoke('sable:load-app-state'),
  savePreferences: (prefs) => ipcRenderer.invoke('sable:save-preferences', prefs),
  saveDrafts: (drafts) => ipcRenderer.invoke('sable:save-drafts', drafts),
  saveRecentWorkspace: (workspacePath) =>
    ipcRenderer.invoke('sable:save-recent-workspace', workspacePath),
  addRecentFile: (filePath) => ipcRenderer.invoke('sable:add-recent-file', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('sable:clear-recent-files'),

  listCustomThemes: () => ipcRenderer.invoke('sable:list-custom-themes'),
  openThemesFolder: () => ipcRenderer.invoke('sable:open-themes-folder'),

  exportPdf: (options) => ipcRenderer.invoke('sable:export-pdf', options),
  exportHtml: (options) => ipcRenderer.invoke('sable:export-html', options),

  syncMenuState: (state: MenuSyncState) => ipcRenderer.send('sable:sync-menu-state', state),
  setWindowTitle: (title: string) => ipcRenderer.send('sable:set-window-title', title),
  openExternal: (url: string) => ipcRenderer.invoke('sable:open-external', url),

  onMenuCommand: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      command: MenuCommand,
      payload?: string
    ): void => {
      callback(command, payload)
    }
    ipcRenderer.on('sable:menu-command', listener)
    return () => ipcRenderer.removeListener('sable:menu-command', listener)
  },

  onOpenFileRequest: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, filePath: string): void => {
      callback(filePath)
    }
    ipcRenderer.on('sable:open-file-request', listener)
    return () => ipcRenderer.removeListener('sable:open-file-request', listener)
  },

  onExternalFileChanged: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { filePath: string; content: string; mtimeMs: number }
    ): void => {
      callback(payload)
    }
    ipcRenderer.on('sable:external-file-changed', listener)
    return () => ipcRenderer.removeListener('sable:external-file-changed', listener)
  },

  onWorkspaceTreeChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, rootDir: string): void => {
      callback(rootDir)
    }
    ipcRenderer.on('sable:workspace-tree-changed', listener)
    return () => ipcRenderer.removeListener('sable:workspace-tree-changed', listener)
  }
}

contextBridge.exposeInMainWorld('sable', api)
