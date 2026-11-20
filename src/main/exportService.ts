import { app, BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import type { PdfMargins, PdfPageSize } from '@shared/types'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif'
}

function getMarginConfig(margins: PdfMargins): {
  top: number
  bottom: number
  left: number
  right: number
} {
  switch (margins) {
    case 'compact':
      return { top: 0.4, bottom: 0.4, left: 0.45, right: 0.45 }
    case 'wide':
      return { top: 1.0, bottom: 1.0, left: 1.1, right: 1.1 }
    default:
      return { top: 0.7, bottom: 0.7, left: 0.75, right: 0.75 }
  }
}

export async function exportPdfDocument(
  options: {
    htmlDocument: string
    defaultPath?: string | null
    pageSize: PdfPageSize
    margins: PdfMargins
  },
  parentWin?: BrowserWindow
): Promise<string | null> {
  const suggestedName = options.defaultPath
    ? options.defaultPath.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '.pdf')
    : 'Untitled.pdf'

  const saveDialogOpts = {
    defaultPath: suggestedName,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
  }

  const saveRes = parentWin
    ? await dialog.showSaveDialog(parentWin, saveDialogOpts)
    : await dialog.showSaveDialog(saveDialogOpts)

  if (saveRes.canceled || !saveRes.filePath) {
    return null
  }

  const tempHtml = path.join(
    app.getPath('temp'),
    `sable-print-${process.pid}-${Date.now()}.html`
  )
  await fs.writeFile(tempHtml, options.htmlDocument, 'utf-8')

  const printWin = new BrowserWindow({
    show: false,
    width: 960,
    height: 1280,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  })

  try {
    await printWin.loadFile(tempHtml)
    await printWin.webContents.executeJavaScript(`
      Promise.race([
        Promise.all([
          document.fonts ? document.fonts.ready : Promise.resolve(),
          ...Array.from(document.images).map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((res) => {
                  img.addEventListener('load', res, { once: true });
                  img.addEventListener('error', res, { once: true });
                })
          )
        ]),
        new Promise((res) => setTimeout(res, 4000))
      ])
    `)

    const marginSpec = getMarginConfig(options.margins)
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: options.pageSize,
      margins: marginSpec
    })

    await fs.writeFile(saveRes.filePath, pdfBuffer)
    return path.resolve(saveRes.filePath)
  } finally {
    if (!printWin.isDestroyed()) {
      printWin.destroy()
    }
    await fs.unlink(tempHtml).catch(() => undefined)
  }
}

async function replaceAssetUrlsInHtml(
  html: string,
  targetHtmlDir: string,
  embedImages: boolean
): Promise<string> {
  const regex = /sable-asset:\/\/local\/file\?path=([^"'&\s>]+)/g
  const matches = Array.from(html.matchAll(regex))
  if (matches.length === 0) return html

  let output = html
  const seen = new Map<string, string>()

  for (const match of matches) {
    const fullToken = match[0]
    if (seen.has(fullToken)) continue
    const decodedPath = decodeURIComponent(match[1])

    if (embedImages) {
      try {
        const buf = await fs.readFile(decodedPath)
        const ext = path.extname(decodedPath).toLowerCase()
        const mime = MIME_BY_EXT[ext] || 'application/octet-stream'
        seen.set(fullToken, `data:${mime};base64,${buf.toString('base64')}`)
      } catch {
        seen.set(fullToken, decodedPath)
      }
    } else {
      const rel = path.relative(targetHtmlDir, decodedPath)
      const posix =
        !rel || rel.startsWith('..') || path.isAbsolute(rel)
          ? decodedPath.replace(/\\/g, '/')
          : `./${rel.split(path.sep).join('/')}`
      seen.set(fullToken, posix)
    }
  }

  for (const [token, replacement] of seen.entries()) {
    output = output.split(token).join(replacement)
  }
  return output
}

export async function exportHtmlDocument(
  options: {
    htmlDocument: string
    defaultPath?: string | null
    docPath?: string | null
    embedImages: boolean
  },
  parentWin?: BrowserWindow
): Promise<string | null> {
  const suggestedName = options.defaultPath
    ? options.defaultPath.replace(/\.(md|markdown|mdown|mkd|txt)$/i, '.html')
    : 'Untitled.html'

  const saveDialogOpts = {
    defaultPath: suggestedName,
    filters: [{ name: 'HTML Document', extensions: ['html', 'htm'] }]
  }

  const saveRes = parentWin
    ? await dialog.showSaveDialog(parentWin, saveDialogOpts)
    : await dialog.showSaveDialog(saveDialogOpts)

  if (saveRes.canceled || !saveRes.filePath) {
    return null
  }

  const finalHtml = await replaceAssetUrlsInHtml(
    options.htmlDocument,
    path.dirname(saveRes.filePath),
    options.embedImages
  )
  await fs.writeFile(saveRes.filePath, finalHtml, 'utf-8')
  return path.resolve(saveRes.filePath)
}
