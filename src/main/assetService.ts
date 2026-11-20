import { app, BrowserWindow, clipboard, dialog } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import type { ImageSaveAction } from '@shared/types'

function toPosixRelative(fromDir: string, targetFile: string): string {
  const rel = path.relative(fromDir, targetFile)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    return targetFile.replace(/\\/g, '/')
  }
  const posix = rel.split(path.sep).join('/')
  return posix.startsWith('./') ? posix : `./${posix}`
}

function resolveTargetAssetDirectory(
  docPath: string | null,
  action: ImageSaveAction,
  customDir: string
): { targetDir: string; baseDocDir: string | null } {
  if (!docPath) {
    return {
      targetDir: path.join(app.getPath('userData'), 'untitled-assets'),
      baseDocDir: null
    }
  }
  const resolvedDoc = path.resolve(docPath)
  const docDir = path.dirname(resolvedDoc)
  const docStem = path.basename(resolvedDoc, path.extname(resolvedDoc))

  if (action === 'copy-custom-dir') {
    const trimmed = customDir.trim() || './assets'
    const dir = path.isAbsolute(trimmed) ? trimmed : path.resolve(docDir, trimmed)
    return { targetDir: dir, baseDocDir: docDir }
  }

  return {
    targetDir: path.join(docDir, `${docStem}.assets`),
    baseDocDir: docDir
  }
}

function buildTimestampName(prefix: string, ext: string): string {
  const now = new Date()
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0')
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    '-',
    pad(now.getMilliseconds(), 3)
  ].join('')
  const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
  return `${prefix}-${stamp}${cleanExt}`
}

async function findAvailableFilePath(dir: string, desiredName: string): Promise<string> {
  const ext = path.extname(desiredName)
  const stem = path.basename(desiredName, ext)
  let candidate = path.join(dir, desiredName)
  let counter = 1
  while (true) {
    try {
      await fs.access(candidate)
      candidate = path.join(dir, `${stem}-${counter}${ext}`)
      counter++
    } catch {
      return candidate
    }
  }
}

export async function saveImageFromClipboard(
  docPath: string | null,
  action: ImageSaveAction,
  customDir: string
): Promise<string | null> {
  const img = clipboard.readImage()
  if (img.isEmpty()) {
    return null
  }
  const pngBuffer = img.toPNG()
  const { targetDir, baseDocDir } = resolveTargetAssetDirectory(
    docPath,
    action === 'keep-original' ? 'copy-doc-assets' : action,
    customDir
  )
  await fs.mkdir(targetDir, { recursive: true })
  const fileName = buildTimestampName('image', '.png')
  const fullTarget = await findAvailableFilePath(targetDir, fileName)
  await fs.writeFile(fullTarget, pngBuffer)

  if (baseDocDir) {
    return toPosixRelative(baseDocDir, fullTarget)
  }
  return fullTarget.replace(/\\/g, '/')
}

export async function importExternalImageFile(
  sourcePath: string,
  docPath: string | null,
  action: ImageSaveAction,
  customDir: string
): Promise<string> {
  const resolvedSource = path.resolve(sourcePath)
  if (action === 'keep-original') {
    if (docPath) {
      return toPosixRelative(path.dirname(path.resolve(docPath)), resolvedSource)
    }
    return resolvedSource.replace(/\\/g, '/')
  }

  const { targetDir, baseDocDir } = resolveTargetAssetDirectory(docPath, action, customDir)
  await fs.mkdir(targetDir, { recursive: true })

  const originalName = path.basename(resolvedSource)
  let finalTarget = path.join(targetDir, originalName)
  if (path.resolve(finalTarget) !== resolvedSource) {
    finalTarget = await findAvailableFilePath(targetDir, originalName)
    await fs.copyFile(resolvedSource, finalTarget)
  }

  if (baseDocDir) {
    return toPosixRelative(baseDocDir, finalTarget)
  }
  return finalTarget.replace(/\\/g, '/')
}

export async function pickAndImportImageDialog(
  docPath: string | null,
  action: ImageSaveAction,
  customDir: string,
  win?: BrowserWindow
): Promise<string | null> {
  const options = {
    properties: ['openFile' as const],
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']
      }
    ]
  }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return importExternalImageFile(result.filePaths[0], docPath, action, customDir)
}
