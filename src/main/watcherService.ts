import { BrowserWindow } from 'electron'
import chokidar, { type FSWatcher } from 'chokidar'
import path from 'path'
import { isRecentSelfWrite, readMarkdownFile } from './fileService'

interface WindowWatchers {
  docWatcher: FSWatcher | null
  docPath: string | null
  workspaceWatcher: FSWatcher | null
  workspaceDir: string | null
  workspaceTimer: NodeJS.Timeout | null
}

const windowWatchers = new Map<number, WindowWatchers>()

function getOrCreateEntry(winId: number): WindowWatchers {
  let entry = windowWatchers.get(winId)
  if (!entry) {
    entry = {
      docWatcher: null,
      docPath: null,
      workspaceWatcher: null,
      workspaceDir: null,
      workspaceTimer: null
    }
    windowWatchers.set(winId, entry)
  }
  return entry
}

export async function watchWindowDocument(
  win: BrowserWindow,
  filePath: string | null
): Promise<void> {
  const entry = getOrCreateEntry(win.id)
  const resolved = filePath ? path.resolve(filePath) : null
  if (entry.docPath === resolved) return

  if (entry.docWatcher) {
    await entry.docWatcher.close().catch(() => undefined)
    entry.docWatcher = null
  }
  entry.docPath = resolved

  if (!resolved) return

  const watcher = chokidar.watch(resolved, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 80
    }
  })

  watcher.on('change', async (changedPath) => {
    if (win.isDestroyed()) return
    try {
      const loaded = await readMarkdownFile(changedPath)
      if (isRecentSelfWrite(loaded.filePath, loaded.mtimeMs)) {
        return
      }
      win.webContents.send('sable:external-file-changed', loaded)
    } catch {
      // Ignore transient rename or unlink errors
    }
  })

  entry.docWatcher = watcher
}

export async function watchWindowWorkspace(
  win: BrowserWindow,
  rootDir: string | null
): Promise<void> {
  const entry = getOrCreateEntry(win.id)
  const resolved = rootDir ? path.resolve(rootDir) : null
  if (entry.workspaceDir === resolved) return

  if (entry.workspaceWatcher) {
    await entry.workspaceWatcher.close().catch(() => undefined)
    entry.workspaceWatcher = null
  }
  if (entry.workspaceTimer) {
    clearTimeout(entry.workspaceTimer)
    entry.workspaceTimer = null
  }
  entry.workspaceDir = resolved

  if (!resolved) return

  const watcher = chokidar.watch(resolved, {
    ignoreInitial: true,
    depth: 6,
    ignored: (watchedPath) => {
      const base = path.basename(watchedPath)
      return (
        base === '.git' ||
        base === 'node_modules' ||
        base.endsWith('.assets') ||
        base.startsWith('.sable-write-')
      )
    }
  })

  const notifyTreeChanged = (): void => {
    if (entry.workspaceTimer) {
      clearTimeout(entry.workspaceTimer)
    }
    entry.workspaceTimer = setTimeout(() => {
      if (!win.isDestroyed() && entry.workspaceDir) {
        win.webContents.send('sable:workspace-tree-changed', entry.workspaceDir)
      }
    }, 300)
  }

  watcher.on('add', notifyTreeChanged)
  watcher.on('unlink', notifyTreeChanged)
  watcher.on('addDir', notifyTreeChanged)
  watcher.on('unlinkDir', notifyTreeChanged)

  entry.workspaceWatcher = watcher
}

export async function disposeWindowWatchers(winId: number): Promise<void> {
  const entry = windowWatchers.get(winId)
  if (!entry) return
  if (entry.workspaceTimer) clearTimeout(entry.workspaceTimer)
  if (entry.docWatcher) await entry.docWatcher.close().catch(() => undefined)
  if (entry.workspaceWatcher) await entry.workspaceWatcher.close().catch(() => undefined)
  windowWatchers.delete(winId)
}
