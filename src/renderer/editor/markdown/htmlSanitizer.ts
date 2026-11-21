const BLOCKED_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'meta',
  'link',
  'base',
  'noscript',
  'template',
  'frame',
  'frameset'
])

const URL_ATTRS = new Set(['href', 'src', 'poster', 'xlink:href'])

function isSafeUrl(url: string, isMediaAttr: boolean): boolean {
  const normalized = url.replace(/[\u0000-\u0020]+/g, '').toLowerCase()
  if (!normalized) return true
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('file:')
  ) {
    return false
  }
  if (normalized.startsWith('data:')) {
    return isMediaAttr && /^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml);/i.test(normalized)
  }
  return true
}

function sanitizeStyleValue(style: string): string {
  const cleaned = style
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/url\s*\(\s*['"]?\s*(?:javascript|vbscript|data:text\/html)[^)]*\)/gi, '')
    .replace(/-moz-binding\s*:[^;]+;?/gi, '')
    .replace(/behavior\s*:[^;]+;?/gi, '')
    .trim()
  return cleaned
}

function sanitizeElementTree(
  root: HTMLElement,
  resolveAssetUrl?: (src: string) => string
): void {
  const children = Array.from(root.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.COMMENT_NODE) {
      child.parentNode?.removeChild(child)
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const el = child as HTMLElement
    const tag = el.tagName.toLowerCase()
    if (BLOCKED_TAGS.has(tag)) {
      el.parentNode?.removeChild(el)
      continue
    }

    for (const attr of Array.from(el.attributes)) {
      const attrName = attr.name.toLowerCase()
      const attrVal = attr.value

      if (attrName.startsWith('on') || attrName === 'srcdoc') {
        el.removeAttribute(attr.name)
        continue
      }

      if (attrName === 'style') {
        const safeStyle = sanitizeStyleValue(attrVal)
        if (safeStyle) {
          el.setAttribute('style', safeStyle)
        } else {
          el.removeAttribute('style')
        }
        continue
      }

      if (URL_ATTRS.has(attrName)) {
        const isMedia = attrName === 'src' || attrName === 'poster'
        if (!isSafeUrl(attrVal, isMedia)) {
          el.removeAttribute(attr.name)
          continue
        }
        if (isMedia && resolveAssetUrl && (tag === 'img' || tag === 'source' || tag === 'video')) {
          el.setAttribute(attr.name, resolveAssetUrl(attrVal))
        }
      }
    }

    if (tag === 'a') {
      el.setAttribute('rel', 'noopener noreferrer')
    }

    sanitizeElementTree(el, resolveAssetUrl)
  }
}

export function sanitizeAndPrepareHtml(
  rawHtml: string,
  resolveAssetUrl?: (src: string) => string
): string {
  const trimmed = (rawHtml || '').trim()
  if (!trimmed) return ''
  if (typeof DOMParser === 'undefined') {
    return trimmed
  }

  const parser = new DOMParser()
  const parsed = parser.parseFromString(trimmed, 'text/html')
  sanitizeElementTree(parsed.body, resolveAssetUrl)
  return parsed.body.innerHTML
}

export function extractHeadingsFromHtml(
  rawHtml: string
): Array<{ level: number; text: string }> {
  const trimmed = (rawHtml || '').trim()
  if (!trimmed || typeof DOMParser === 'undefined') return []

  const parser = new DOMParser()
  const parsed = parser.parseFromString(trimmed, 'text/html')
  const headings: Array<{ level: number; text: string }> = []
  parsed.body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const level = Number(el.tagName.slice(1))
    const text = (el.textContent || '').trim()
    if (level >= 1 && level <= 6 && text) {
      headings.push({ level, text })
    }
  })
  return headings
}
