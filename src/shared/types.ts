export type ImageSaveAction = 'copy-doc-assets' | 'copy-custom-dir' | 'keep-original'
export type SidebarPanel = 'outline' | 'files'
export type PdfPageSize = 'A4' | 'Letter'
export type PdfMargins = 'default' | 'compact' | 'wide'

export interface SablePreferences {
  autoSave: boolean
  autoSaveDelayMs: number
  showTabBar: boolean
  showSidebar: boolean
  sidebarTab: SidebarPanel
  sidebarWidth: number
  theme: string
  inlineSyntaxReveal: boolean
  showFloatingToolbar: boolean
  enableSlashMenu: boolean
  focusMode: boolean
  typewriterMode: boolean
  sourceCodeMode: boolean
  imageAction: ImageSaveAction
  customImageDir: string
  pdfPageSize: PdfPageSize
  pdfMargins: PdfMargins
  htmlEmbedImages: boolean
  fontSize: number
}

export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
}

export interface WorkspaceSearchResult {
  filePath: string
  fileName: string
  line: number
  preview: string
}

export interface LoadedDocument {
  filePath: string
  content: string
  mtimeMs: number
}

export interface DraftData {
  id: string
  title: string
  content: string
  updatedAt: number
}

export interface CustomThemeDescriptor {
  id: string
  name: string
  cssContent: string
}

export interface PersistedAppState {
  preferences: SablePreferences
  recentFiles: string[]
  recentWorkspace: string | null
  drafts: DraftData[]
}

export interface MenuSyncState {
  showSidebar: boolean
  sidebarTab: SidebarPanel
  showTabBar: boolean
  sourceCodeMode: boolean
  focusMode: boolean
  typewriterMode: boolean
  theme: string
  customThemes: { id: string; name: string }[]
  recentFiles: string[]
}

export type MenuCommand =
  | 'file:new'
  | 'file:new-window'
  | 'file:open'
  | 'file:open-folder'
  | 'file:open-recent'
  | 'file:clear-recent'
  | 'file:save'
  | 'file:save-as'
  | 'file:export-pdf'
  | 'file:export-html'
  | 'file:preferences'
  | 'edit:undo'
  | 'edit:redo'
  | 'edit:copy-markdown'
  | 'edit:copy-html'
  | 'edit:find'
  | 'para:heading-1'
  | 'para:heading-2'
  | 'para:heading-3'
  | 'para:heading-4'
  | 'para:heading-5'
  | 'para:heading-6'
  | 'para:heading-promote'
  | 'para:heading-demote'
  | 'para:paragraph'
  | 'para:table'
  | 'para:code-block'
  | 'para:math-block'
  | 'para:mermaid-block'
  | 'para:blockquote'
  | 'para:ordered-list'
  | 'para:bullet-list'
  | 'para:task-list'
  | 'para:hr'
  | 'para:toc'
  | 'format:strong'
  | 'format:em'
  | 'format:strike'
  | 'format:code'
  | 'format:math-inline'
  | 'format:link'
  | 'format:image'
  | 'format:clear'
  | 'view:toggle-sidebar'
  | 'view:outline'
  | 'view:files'
  | 'view:toggle-tabs'
  | 'view:toggle-source'
  | 'view:toggle-focus'
  | 'view:toggle-typewriter'
  | 'theme:select'
  | 'theme:refresh'
  | 'theme:open-folder'
  | 'help:shortcuts'
  | 'help:markdown-guide'
  | 'help:about'

export interface SableBridgeAPI {
  openFileDialog: () => Promise<LoadedDocument | null>
  openFolderDialog: () => Promise<string | null>
  readFile: (filePath: string) => Promise<LoadedDocument>
  writeFile: (filePath: string, content: string) => Promise<{ mtimeMs: number }>
  saveFileAs: (content: string, defaultPath?: string | null) => Promise<LoadedDocument | null>
  createEntry: (parentDir: string, name: string, isDirectory: boolean) => Promise<string>
  renameEntry: (oldPath: string, newPath: string) => Promise<string>
  deleteEntry: (targetPath: string) => Promise<void>
  readWorkspaceTree: (rootDir: string) => Promise<FileTreeNode[]>
  searchWorkspace: (rootDir: string, query: string) => Promise<WorkspaceSearchResult[]>
  watchDocument: (filePath: string | null) => Promise<void>
  watchWorkspace: (rootDir: string | null) => Promise<void>

  saveClipboardImage: (
    docPath: string | null,
    action: ImageSaveAction,
    customDir: string
  ) => Promise<string | null>
  importImageFile: (
    sourcePath: string,
    docPath: string | null,
    action: ImageSaveAction,
    customDir: string
  ) => Promise<string>
  pickAndImportImage: (
    docPath: string | null,
    action: ImageSaveAction,
    customDir: string
  ) => Promise<string | null>
  resolveAssetUrl: (src: string, docPath: string | null) => string

  loadAppState: () => Promise<PersistedAppState>
  savePreferences: (prefs: SablePreferences) => Promise<void>
  saveDrafts: (drafts: DraftData[]) => Promise<void>
  saveRecentWorkspace: (workspacePath: string | null) => Promise<void>
  addRecentFile: (filePath: string) => Promise<string[]>
  clearRecentFiles: () => Promise<void>

  listCustomThemes: () => Promise<CustomThemeDescriptor[]>
  openThemesFolder: () => Promise<void>

  exportPdf: (options: {
    htmlDocument: string
    defaultPath?: string | null
    pageSize: PdfPageSize
    margins: PdfMargins
  }) => Promise<string | null>
  exportHtml: (options: {
    htmlDocument: string
    defaultPath?: string | null
    docPath?: string | null
    embedImages: boolean
  }) => Promise<string | null>

  syncMenuState: (state: MenuSyncState) => void
  setWindowTitle: (title: string) => void
  openExternal: (url: string) => Promise<void>

  onMenuCommand: (callback: (command: MenuCommand, payload?: string) => void) => () => void
  onOpenFileRequest: (callback: (filePath: string) => void) => () => void
  onExternalFileChanged: (
    callback: (event: { filePath: string; content: string; mtimeMs: number }) => void
  ) => () => void
  onWorkspaceTreeChanged: (callback: (rootDir: string) => void) => () => void
}
