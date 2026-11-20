import { app, shell } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_PREFERENCES } from '@shared/defaults'
import type {
  CustomThemeDescriptor,
  DraftData,
  PersistedAppState,
  SablePreferences,
  WindowBounds
} from '@shared/types'

const STATE_FILE = 'sable-state.json'

function getStateFilePath(): string {
  return path.join(app.getPath('userData'), STATE_FILE)
}

export function getThemesFolderPath(): string {
  return path.join(app.getPath('userData'), 'themes')
}

const DEFAULT_APP_STATE: PersistedAppState = {
  preferences: { ...DEFAULT_PREFERENCES },
  recentFiles: [],
  recentWorkspace: null,
  drafts: []
}

let cachedState: PersistedAppState | null = null

export async function ensureThemesFolder(): Promise<string> {
  const dir = getThemesFolderPath()
  await fs.mkdir(dir, { recursive: true })
  const readmePath = path.join(dir, 'README.txt')
  try {
    await fs.access(readmePath)
  } catch {
    await fs.writeFile(
      readmePath,
      [
        'Sable Custom Themes Directory',
        '',
        'Place any .css file in this folder to add a custom theme.',
        'Override --sable-* CSS variables on :root or .sable-editor-surface to customize colors and typography.'
      ].join('\n'),
      'utf-8'
    )
  }
  return dir
}

export async function loadPersistedState(): Promise<PersistedAppState> {
  if (cachedState) {
    return cachedState
  }
  try {
    const raw = await fs.readFile(getStateFilePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>
    cachedState = {
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences ?? {}) },
      recentFiles: Array.isArray(parsed.recentFiles) ? parsed.recentFiles.slice(0, 15) : [],
      recentWorkspace: typeof parsed.recentWorkspace === 'string' ? parsed.recentWorkspace : null,
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      windowBounds: parsed.windowBounds
    }
  } catch {
    cachedState = {
      preferences: { ...DEFAULT_PREFERENCES },
      recentFiles: [],
      recentWorkspace: null,
      drafts: []
    }
  }
  return cachedState
}

async function flushState(state: PersistedAppState): Promise<void> {
  cachedState = state
  const target = getStateFilePath()
  await fs.mkdir(path.dirname(target), { recursive: true })
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`
  const payload = JSON.stringify(state, null, 2)
  try {
    await fs.writeFile(temp, payload, 'utf-8')
    await fs.rename(temp, target)
  } catch {
    await fs.writeFile(target, payload, 'utf-8')
    await fs.unlink(temp).catch(() => undefined)
  }
}

export async function updatePreferences(prefs: SablePreferences): Promise<void> {
  const current = await loadPersistedState()
  await flushState({
    ...current,
    preferences: { ...DEFAULT_PREFERENCES, ...prefs }
  })
}

export async function updateDrafts(drafts: DraftData[]): Promise<void> {
  const current = await loadPersistedState()
  await flushState({
    ...current,
    drafts
  })
}

export async function updateRecentWorkspace(workspacePath: string | null): Promise<void> {
  const current = await loadPersistedState()
  await flushState({
    ...current,
    recentWorkspace: workspacePath
  })
}

export async function updateWindowBounds(windowBounds: WindowBounds): Promise<void> {
  const current = await loadPersistedState()
  await flushState({
    ...current,
    windowBounds
  })
}

export async function pushRecentFile(filePath: string): Promise<string[]> {
  const current = await loadPersistedState()
  const normalized = path.resolve(filePath)
  const nextRecent = [
    normalized,
    ...current.recentFiles.filter((item) => path.resolve(item) !== normalized)
  ].slice(0, 15)
  await flushState({
    ...current,
    recentFiles: nextRecent
  })
  return nextRecent
}

export async function clearRecentFileList(): Promise<void> {
  const current = await loadPersistedState()
  await flushState({
    ...current,
    recentFiles: []
  })
}

export async function listCustomThemes(): Promise<CustomThemeDescriptor[]> {
  const dir = await ensureThemesFolder()
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const themes: CustomThemeDescriptor[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.css')) {
      continue
    }
    const fullPath = path.join(dir, entry.name)
    try {
      const cssContent = await fs.readFile(fullPath, 'utf-8')
      const stem = entry.name.slice(0, -4)
      const id = `custom:${stem.toLowerCase()}`
      themes.push({
        id,
        name: stem,
        cssContent
      })
    } catch {
      // Ignore unreadable custom CSS files
    }
  }
  return themes.sort((a, b) => a.name.localeCompare(b.name))
}

export async function openCustomThemesFolder(): Promise<void> {
  const dir = await ensureThemesFolder()
  await shell.openPath(dir)
}
