import { dialog, shell, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import type { FileTreeNode, LoadedDocument, WorkspaceSearchResult } from '@shared/types'

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.hg',
  '.svn',
  '.idea',
  '.vscode',
  'dist',
  'out',
  '__pycache__'
])

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.txt'])

const recentSelfWrites = new Map<string, number>()

export function isRecentSelfWrite(filePath: string, mtimeMs: number): boolean {
  const resolved = path.resolve(filePath)
  const recorded = recentSelfWrites.get(resolved)
  if (recorded === undefined) return false
  return Math.abs(recorded - mtimeMs) < 1500
}

export async function readMarkdownFile(filePath: string): Promise<LoadedDocument> {
  const resolved = path.resolve(filePath)
  const [rawContent, stat] = await Promise.all([
    fs.readFile(resolved, 'utf-8'),
    fs.stat(resolved)
  ])
  const normalizedContent = rawContent.replace(/\r\n/g, '\n')
  return {
    filePath: resolved,
    content: normalizedContent,
    mtimeMs: stat.mtimeMs
  }
}

export async function writeFileAtomic(
  filePath: string,
  content: string
): Promise<{ mtimeMs: number }> {
  const resolved = path.resolve(filePath)
  await fs.mkdir(path.dirname(resolved), { recursive: true })
  const tempPath = path.join(
    path.dirname(resolved),
    `.sable-write-${process.pid}-${Date.now()}.tmp`
  )
  try {
    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, resolved)
  } catch {
    await fs.writeFile(resolved, content, 'utf-8')
    await fs.unlink(tempPath).catch(() => undefined)
  }
  const stat = await fs.stat(resolved)
  recentSelfWrites.set(resolved, stat.mtimeMs)
  return { mtimeMs: stat.mtimeMs }
}

export async function openMarkdownDialog(win?: BrowserWindow): Promise<LoadedDocument | null> {
  const result = win
    ? await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
          { name: 'Markdown Documents', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
    : await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Markdown Documents', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return readMarkdownFile(result.filePaths[0])
}

export async function openWorkspaceFolderDialog(win?: BrowserWindow): Promise<string | null> {
  const result = win
    ? await dialog.showOpenDialog(win, {
        properties: ['openDirectory', 'createDirectory']
      })
    : await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
      })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return path.resolve(result.filePaths[0])
}

export async function saveMarkdownAsDialog(
  content: string,
  defaultPath?: string | null,
  win?: BrowserWindow
): Promise<LoadedDocument | null> {
  const options = {
    defaultPath: defaultPath || 'Untitled.md',
    filters: [
      { name: 'Markdown Document', extensions: ['md', 'markdown'] },
      { name: 'Plain Text', extensions: ['txt'] }
    ]
  }
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)

  if (result.canceled || !result.filePath) {
    return null
  }
  const { mtimeMs } = await writeFileAtomic(result.filePath, content)
  return {
    filePath: path.resolve(result.filePath),
    content,
    mtimeMs
  }
}

export async function createWorkspaceEntry(
  parentDir: string,
  name: string,
  isDirectory: boolean
): Promise<string> {
  const sanitized = name.trim()
  if (!sanitized) {
    throw new Error('Entry name cannot be empty')
  }
  const fullPath = path.join(parentDir, sanitized)
  if (isDirectory) {
    await fs.mkdir(fullPath, { recursive: true })
    return fullPath
  }
  const finalPath = path.extname(fullPath) ? fullPath : `${fullPath}.md`
  await writeFileAtomic(finalPath, '')
  return finalPath
}

export function rewriteRenamedAssetLinks(
  markdown: string,
  oldStem: string,
  newStem: string
): string {
  if (!oldStem || !newStem || oldStem === newStem) return markdown
  const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const variants = [
    [oldStem, newStem],
    [encodeURIComponent(oldStem), encodeURIComponent(newStem)]
  ]

  let result = markdown
  for (const [fromStem, toStem] of variants) {
    if (!fromStem || fromStem === toStem) continue
    const pattern = new RegExp(
      `(\\.\\/|["'(\\[\\s])${escapeRegex(fromStem)}\\.assets(\\/)`,
      'g'
    )
    result = result.replace(pattern, `$1${toStem}.assets$2`)

    const lineStartPattern = new RegExp(`^${escapeRegex(fromStem)}\\.assets(\\/)`, 'gm')
    result = result.replace(lineStartPattern, `${toStem}.assets$1`)
  }
  return result
}

export async function renameWorkspaceEntry(
  oldPath: string,
  newPath: string
): Promise<{ newPath: string; updatedContent: string | null }> {
  const resolvedOld = path.resolve(oldPath)
  const resolvedNew = path.resolve(newPath)
  await fs.rename(resolvedOld, resolvedNew)

  const oldExt = path.extname(resolvedOld).toLowerCase()
  const newExt = path.extname(resolvedNew).toLowerCase()
  const oldDir = path.dirname(resolvedOld)
  const newDir = path.dirname(resolvedNew)

  if (MARKDOWN_EXTENSIONS.has(oldExt) && MARKDOWN_EXTENSIONS.has(newExt) && oldDir === newDir) {
    const oldStem = path.basename(resolvedOld, path.extname(resolvedOld))
    const newStem = path.basename(resolvedNew, path.extname(resolvedNew))
    if (oldStem !== newStem) {
      const oldAssetsDir = path.join(oldDir, `${oldStem}.assets`)
      const newAssetsDir = path.join(newDir, `${newStem}.assets`)
      try {
        const stat = await fs.stat(oldAssetsDir)
        const targetExists = await fs
          .access(newAssetsDir)
          .then(() => true)
          .catch(() => false)
        if (stat.isDirectory() && !targetExists) {
          await fs.rename(oldAssetsDir, newAssetsDir)
          const rawMd = (await fs.readFile(resolvedNew, 'utf-8')).replace(/\r\n/g, '\n')
          const updatedMd = rewriteRenamedAssetLinks(rawMd, oldStem, newStem)
          if (updatedMd !== rawMd) {
            await writeFileAtomic(resolvedNew, updatedMd)
          }
          return { newPath: resolvedNew, updatedContent: updatedMd }
        }
      } catch {
        // No companion .assets folder to rename
      }
    }
  }

  return { newPath: resolvedNew, updatedContent: null }
}

export async function deleteWorkspaceEntry(targetPath: string): Promise<void> {
  const resolved = path.resolve(targetPath)
  try {
    await shell.trashItem(resolved)
  } catch {
    await fs.rm(resolved, { recursive: true, force: true })
  }
}

export async function readWorkspaceTree(
  rootDir: string,
  depth = 0
): Promise<FileTreeNode[]> {
  if (depth > 8) return []
  let entries
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes: FileTreeNode[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.github') {
      continue
    }
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.endsWith('.assets')) {
        continue
      }
      const children = await readWorkspaceTree(fullPath, depth + 1)
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: true,
        children
      })
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (MARKDOWN_EXTENSIONS.has(ext)) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false
        })
      }
    }
  }

  return nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}

export async function searchWorkspaceFiles(
  rootDir: string,
  query: string
): Promise<WorkspaceSearchResult[]> {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []
  const results: WorkspaceSearchResult[] = []
  const maxResults = 150

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 8 || results.length >= maxResults) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= maxResults) break
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.endsWith('.assets')) continue
        await walk(fullPath, depth + 1)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (!MARKDOWN_EXTENSIONS.has(ext)) continue
        try {
          const text = await fs.readFile(fullPath, 'utf-8')
          const lines = text.replace(/\r\n/g, '\n').split('\n')
          if (entry.name.toLowerCase().includes(trimmed)) {
            results.push({
              filePath: fullPath,
              fileName: entry.name,
              line: 1,
              preview: lines[0]?.slice(0, 120) || entry.name
            })
          }
          for (let i = 0; i < lines.length && results.length < maxResults; i++) {
            if (lines[i].toLowerCase().includes(trimmed)) {
              results.push({
                filePath: fullPath,
                fileName: entry.name,
                line: i + 1,
                preview: lines[i].trim().slice(0, 140)
              })
            }
          }
        } catch {
          // Ignore unreadable files
        }
      }
    }
  }

  await walk(rootDir, 0)
  return results
}
