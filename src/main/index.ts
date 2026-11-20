import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, screen, shell } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import type {
  DraftData,
  ImageSaveAction,
  MenuSyncState,
  PdfMargins,
  PdfPageSize,
  SablePreferences,
  WindowBounds
} from '@shared/types'
import {
  importExternalImageFile,
  pickAndImportImageDialog,
  saveImageFromClipboard
} from './assetService'
import { exportHtmlDocument, exportPandocDocument, exportPdfDocument } from './exportService'
import { registerWindowsShellIntegration, unregisterWindowsShellIntegration } from './shellIntegration'
import {
  createWorkspaceEntry,
  deleteWorkspaceEntry,
  openMarkdownDialog,
  openWorkspaceFolderDialog,
  readMarkdownFile,
  readWorkspaceTree,
  renameWorkspaceEntry,
  saveMarkdownAsDialog,
  searchWorkspaceFiles,
  writeFileAtomic
} from './fileService'
import { buildAndApplyApplicationMenu } from './menu'
import {
  clearRecentFileList,
  ensureThemesFolder,
  listCustomThemes,
  loadPersistedState,
  openCustomThemesFolder,
  pushRecentFile,
  updateDrafts,
  updatePreferences,
  updateRecentWorkspace,
  updateWindowBounds
} from './stateService'
import {
  disposeWindowWatchers,
  watchWindowDocument,
  watchWindowWorkspace
} from './watcherService'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'sable-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
])

function extractMarkdownArg(argv: string[]): string | null {
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('-')) continue
    if (/\.(md|markdown|mdown|mkd|txt)$/i.test(arg)) {
      return path.resolve(arg)
    }
  }
  return null
}

const isSmokeTest = process.argv.includes('--smoke-test')
let pendingLaunchFile: string | null = extractMarkdownArg(process.argv)

function resolveWindowIconPath(): string | undefined {
  const ext = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  const candidate = path.join(__dirname, '../../resources', ext)
  return candidate
}

function isBoundsVisibleOnDisplays(bounds: WindowBounds): boolean {
  if (bounds.x === undefined || bounds.y === undefined) return false
  const displays = screen.getAllDisplays()
  return displays.some((d) => {
    const area = d.workArea
    return (
      bounds.x! + bounds.width > area.x + 80 &&
      bounds.x! < area.x + area.width - 80 &&
      bounds.y! + bounds.height > area.y + 60 &&
      bounds.y! < area.y + area.height - 60
    )
  })
}

function createEditorWindow(
  initialFilePath?: string | null,
  savedBounds?: WindowBounds
): BrowserWindow {
  if (initialFilePath) {
    pendingLaunchFile = initialFilePath
  }
  const isMac = process.platform === 'darwin'
  const useSavedPos = savedBounds && isBoundsVisibleOnDisplays(savedBounds)

  const win = new BrowserWindow({
    width: savedBounds?.width || 1340,
    height: savedBounds?.height || 860,
    ...(useSavedPos ? { x: savedBounds.x, y: savedBounds.y } : {}),
    minWidth: 720,
    minHeight: 480,
    title: 'Sable',
    icon: resolveWindowIconPath(),
    frame: isMac,
    thickFrame: true,
    autoHideMenuBar: !isMac,
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })

  let boundsSaveTimer: NodeJS.Timeout | null = null
  const scheduleBoundsSave = (): void => {
    if (boundsSaveTimer) clearTimeout(boundsSaveTimer)
    boundsSaveTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      const isMax = win.isMaximized()
      const normalBounds = win.getNormalBounds()
      void updateWindowBounds({
        x: normalBounds.x,
        y: normalBounds.y,
        width: normalBounds.width,
        height: normalBounds.height,
        isMaximized: isMax
      })
    }, 350)
  }

  win.on('resize', scheduleBoundsSave)
  win.on('move', scheduleBoundsSave)

  win.on('maximize', () => {
    scheduleBoundsSave()
    if (!win.isDestroyed()) {
      win.webContents.send('sable:window-maximized', true)
    }
  })

  win.on('unmaximize', () => {
    scheduleBoundsSave()
    if (!win.isDestroyed()) {
      win.webContents.send('sable:window-maximized', false)
    }
  })

  win.once('ready-to-show', () => {
    if (!isSmokeTest) {
      if (savedBounds?.isMaximized) {
        win.maximize()
      }
      win.show()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  win.on('closed', () => {
    void disposeWindowWatchers(win.id)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerIpcHandlers(): void {
  ipcMain.handle('sable:open-file-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    return openMarkdownDialog(win)
  })

  ipcMain.handle('sable:open-folder-dialog', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    return openWorkspaceFolderDialog(win)
  })

  ipcMain.handle('sable:read-file', async (_event, filePath: string) => {
    return readMarkdownFile(filePath)
  })

  ipcMain.handle('sable:write-file', async (_event, filePath: string, content: string) => {
    return writeFileAtomic(filePath, content)
  })

  ipcMain.handle(
    'sable:save-file-as',
    async (event, content: string, defaultPath?: string | null) => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      return saveMarkdownAsDialog(content, defaultPath, win)
    }
  )

  ipcMain.handle(
    'sable:create-entry',
    async (_event, parentDir: string, name: string, isDirectory: boolean) => {
      return createWorkspaceEntry(parentDir, name, isDirectory)
    }
  )

  ipcMain.handle('sable:rename-entry', async (_event, oldPath: string, newPath: string) => {
    return renameWorkspaceEntry(oldPath, newPath)
  })

  ipcMain.handle('sable:delete-entry', async (_event, targetPath: string) => {
    return deleteWorkspaceEntry(targetPath)
  })

  ipcMain.handle('sable:read-workspace-tree', async (_event, rootDir: string) => {
    return readWorkspaceTree(rootDir)
  })

  ipcMain.handle('sable:search-workspace', async (_event, rootDir: string, query: string) => {
    return searchWorkspaceFiles(rootDir, query)
  })

  ipcMain.handle('sable:watch-document', async (event, filePath: string | null) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      await watchWindowDocument(win, filePath)
    }
  })

  ipcMain.handle('sable:watch-workspace', async (event, rootDir: string | null) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      await watchWindowWorkspace(win, rootDir)
    }
  })

  ipcMain.handle(
    'sable:save-clipboard-image',
    async (_event, docPath: string | null, action: ImageSaveAction, customDir: string) => {
      return saveImageFromClipboard(docPath, action, customDir)
    }
  )

  ipcMain.handle(
    'sable:import-image-file',
    async (
      _event,
      sourcePath: string,
      docPath: string | null,
      action: ImageSaveAction,
      customDir: string
    ) => {
      return importExternalImageFile(sourcePath, docPath, action, customDir)
    }
  )

  ipcMain.handle(
    'sable:pick-import-image',
    async (event, docPath: string | null, action: ImageSaveAction, customDir: string) => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      return pickAndImportImageDialog(docPath, action, customDir, win)
    }
  )

  ipcMain.handle('sable:load-app-state', async () => {
    return loadPersistedState()
  })

  ipcMain.handle('sable:consume-launch-file', () => {
    const file = pendingLaunchFile
    pendingLaunchFile = null
    return file
  })

  ipcMain.handle('sable:save-preferences', async (_event, prefs: SablePreferences) => {
    await updatePreferences(prefs)
  })

  ipcMain.handle('sable:save-drafts', async (_event, drafts: DraftData[]) => {
    await updateDrafts(drafts)
  })

  ipcMain.handle('sable:save-recent-workspace', async (_event, workspacePath: string | null) => {
    await updateRecentWorkspace(workspacePath)
  })

  ipcMain.handle('sable:add-recent-file', async (_event, filePath: string) => {
    return pushRecentFile(filePath)
  })

  ipcMain.handle('sable:clear-recent-files', async () => {
    await clearRecentFileList()
  })

  ipcMain.handle('sable:list-custom-themes', async () => {
    return listCustomThemes()
  })

  ipcMain.handle('sable:open-themes-folder', async () => {
    await openCustomThemesFolder()
  })

  ipcMain.handle(
    'sable:export-pdf',
    async (
      event,
      options: {
        htmlDocument: string
        defaultPath?: string | null
        pageSize: PdfPageSize
        margins: PdfMargins
      }
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      return exportPdfDocument(options, win)
    }
  )

  ipcMain.handle(
    'sable:export-html',
    async (
      event,
      options: {
        htmlDocument: string
        defaultPath?: string | null
        docPath?: string | null
        embedImages: boolean
      }
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      return exportHtmlDocument(options, win)
    }
  )

  ipcMain.handle(
    'sable:export-pandoc',
    async (
      event,
      options: {
        markdown: string
        format: 'docx' | 'latex'
        defaultPath?: string | null
        docPath?: string | null
        bibPath?: string
      }
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      return exportPandocDocument(options, win)
    }
  )

  ipcMain.handle('sable:confirm-unsaved-close', async (event, docTitle: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const msgOpts = {
      type: 'question' as const,
      buttons: ['保存', '不保存直接关闭', '取消'],
      defaultId: 0,
      cancelId: 2,
      title: 'Sable',
      message: `草稿 "${docTitle}" 尚未保存到本地磁盘`,
      detail: '关闭前是否先将其保存为本地 Markdown 文件？'
    }
    const res = win
      ? await dialog.showMessageBox(win, msgOpts)
      : await dialog.showMessageBox(msgOpts)
    if (res.response === 0) return 'save'
    if (res.response === 1) return 'discard'
    return 'cancel'
  })

  ipcMain.handle('sable:register-win-integration', async () => {
    return registerWindowsShellIntegration()
  })

  ipcMain.handle('sable:unregister-win-integration', async () => {
    return unregisterWindowsShellIntegration()
  })

  ipcMain.on('sable:sync-menu-state', (_event, state: MenuSyncState) => {
    buildAndApplyApplicationMenu(state, () => createEditorWindow())
  })

  ipcMain.on('sable:set-window-title', (event, title: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.setTitle(title)
    }
  })

  ipcMain.handle('sable:open-external', async (_event, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      await shell.openExternal(url)
    }
  })

  ipcMain.handle('sable:window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.minimize()
  })

  ipcMain.handle('sable:window-toggle-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return false
    if (win.isMaximized()) {
      win.unmaximize()
      return false
    }
    win.maximize()
    return true
  })

  ipcMain.handle('sable:window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) win.close()
  })

  ipcMain.handle('sable:window-is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win && !win.isDestroyed() ? win.isMaximized() : false
  })

  ipcMain.handle('sable:new-window', () => {
    createEditorWindow()
  })
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const fileToOpen = extractMarkdownArg(argv)
    const existing = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
      if (fileToOpen) {
        existing.webContents.send('sable:open-file-request', fileToOpen)
      }
    } else {
      createEditorWindow(fileToOpen)
    }
  })

  app.whenReady().then(async () => {
    protocol.handle('sable-asset', async (request) => {
      try {
        const parsed = new URL(request.url)
        const targetPath = parsed.searchParams.get('path')
        if (!targetPath) {
          return new Response('Missing path', { status: 400 })
        }
        const resolved = path.resolve(targetPath)
        const stat = await fs.stat(resolved)
        if (!stat.isFile()) {
          return new Response('Not found', { status: 404 })
        }
        return net.fetch(pathToFileURL(resolved).toString())
      } catch {
        return new Response('Asset read error', { status: 404 })
      }
    })

    await ensureThemesFolder()
    registerIpcHandlers()
    const initialState = await loadPersistedState()
    const customThemes = await listCustomThemes()
    buildAndApplyApplicationMenu(
      {
        showSidebar: initialState.preferences.showSidebar,
        sidebarTab: initialState.preferences.sidebarTab,
        showTabBar: initialState.preferences.showTabBar,
        sourceCodeMode: initialState.preferences.sourceCodeMode,
        focusMode: initialState.preferences.focusMode,
        typewriterMode: initialState.preferences.typewriterMode,
        theme: initialState.preferences.theme,
        customThemes: customThemes.map((t) => ({ id: t.id, name: t.name })),
        recentFiles: initialState.recentFiles
      },
      () => createEditorWindow()
    )

    const startupFile = extractMarkdownArg(process.argv)
    const mainWin = createEditorWindow(startupFile, initialState.windowBounds)

    if (isSmokeTest) {
      mainWin.webContents.once('did-finish-load', async () => {
        try {
          await new Promise((res) => setTimeout(res, 600))
          const probe = await mainWin.webContents.executeJavaScript(`({
            hasBridge: typeof window.sable?.readFile === 'function',
            hasProseMirror: Boolean(document.querySelector('.sable-editor-surface .ProseMirror')),
            hasStatusBar: Boolean(document.querySelector('footer'))
          })`)
          const menuCount = Menu.getApplicationMenu()?.items.length ?? 0
          if (probe.hasBridge && probe.hasProseMirror && probe.hasStatusBar && menuCount === 7) {
            console.log('SABLE_SMOKE_OK', JSON.stringify({ ...probe, menuCount }))
            app.exit(0)
          } else {
            console.error('SABLE_SMOKE_FAILED', JSON.stringify({ ...probe, menuCount }))
            app.exit(1)
          }
        } catch (err) {
          console.error('SABLE_SMOKE_ERROR', err)
          app.exit(1)
        }
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createEditorWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
