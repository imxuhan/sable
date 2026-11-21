import katex from 'katex'
import mermaid from 'mermaid'
import { DOMSerializer, type Node as PMNode } from 'prosemirror-model'
import { sableSchema } from './schema/sableSchema'
import { markdownToDoc } from './markdown/converter'
import { sanitizeAndPrepareHtml } from './markdown/htmlSanitizer'
import { getHeadingsFromState } from './plugins/commandsAndKeymap'
import { EditorState } from 'prosemirror-state'

let exportMermaidSeq = 0

export async function buildStandaloneExportHtml(options: {
  markdown: string
  title: string
  docPath: string | null
  themeCss: string
  katexCss: string
}): Promise<string> {
  const doc: PMNode = markdownToDoc(options.markdown)
  const tempState = EditorState.create({ doc, schema: sableSchema })
  const headings = getHeadingsFromState(tempState)

  const serializer = DOMSerializer.fromSchema(sableSchema)
  const container = document.createElement('div')
  container.appendChild(serializer.serializeFragment(doc.content))

  container.querySelectorAll('div[data-type="frontmatter"]').forEach((el) => {
    el.remove()
  })

  const resolveExportAssetUrl =
    typeof window !== 'undefined' && window.sable
      ? (src: string) => window.sable.resolveAssetUrl(src, options.docPath)
      : undefined

  container.querySelectorAll('div[data-type="html-block"]').forEach((el) => {
    const rawHtml = el.getAttribute('data-value') || ''
    const wrap = document.createElement('div')
    wrap.className = 'sable-html-block-preview'
    wrap.innerHTML = sanitizeAndPrepareHtml(rawHtml, resolveExportAssetUrl)
    el.replaceWith(wrap)
  })

  container.querySelectorAll('div[data-type="toc"]').forEach((el) => {
    const nav = document.createElement('nav')
    nav.className = 'sable-toc-card'
    const minLevel = headings.length > 0 ? Math.min(...headings.map((h) => h.level)) : 1
    nav.innerHTML =
      '<div class="sable-toc-title">目录</div>' +
      headings
        .map(
          (h, idx) =>
            `<div class="sable-toc-item" style="padding-left:${(h.level - minLevel) * 16}px"><a href="#heading-${idx}">${escapeHtml(h.text)}</a></div>`
        )
        .join('')
    el.replaceWith(nav)
  })

  let headingIdx = 0
  container.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    el.id = `heading-${headingIdx++}`
  })

  container.querySelectorAll('div[data-type="math-block"]').forEach((el) => {
    const expr = el.getAttribute('data-value') || ''
    const rendered = document.createElement('div')
    rendered.className = 'sable-math-block-preview'
    rendered.innerHTML = expr.trim()
      ? katex.renderToString(expr, { displayMode: true, throwOnError: false, strict: false })
      : ''
    el.replaceWith(rendered)
  })

  container.querySelectorAll('span[data-type="math-inline"]').forEach((el) => {
    const expr = el.getAttribute('data-value') || ''
    const rendered = document.createElement('span')
    rendered.className = 'sable-math-inline-render'
    rendered.innerHTML = expr.trim()
      ? katex.renderToString(expr, { displayMode: false, throwOnError: false, strict: false })
      : ''
    el.replaceWith(rendered)
  })

  const mermaidEls = Array.from(container.querySelectorAll('div[data-type="mermaid-block"]'))
  if (mermaidEls.length > 0) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
    for (const el of mermaidEls) {
      const code = el.getAttribute('data-value') || ''
      const wrap = document.createElement('div')
      wrap.className = 'sable-mermaid-preview'
      if (code.trim()) {
        try {
          const { svg } = await mermaid.render(`sable-exp-mmd-${++exportMermaidSeq}`, code.trim())
          wrap.innerHTML = svg
        } catch {
          wrap.innerHTML = `<pre><code>${escapeHtml(code)}</code></pre>`
        }
      }
      el.replaceWith(wrap)
    }
  }

  container.querySelectorAll('img[src]').forEach((el) => {
    const rawSrc = el.getAttribute('src') || ''
    if (typeof window !== 'undefined' && window.sable) {
      el.setAttribute('src', window.sable.resolveAssetUrl(rawSrc, options.docPath))
    }
  })

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(options.title)}</title>
  <style>${options.katexCss}</style>
  <style>${options.themeCss}</style>
  <style>
    body {
      margin: 0;
      background: var(--sable-bg, #ffffff);
      color: var(--sable-fg, #1f2328);
    }
    .sable-export-container {
      max-width: var(--sable-max-width, 820px);
      margin: 0 auto;
      padding: 40px 32px 64px;
    }
    .sable-html-block-preview [align="center"] {
      text-align: center;
    }
    .sable-html-block-preview [align="right"] {
      text-align: right;
    }
    .sable-html-block-preview [align="left"] {
      text-align: left;
    }
    .sable-html-block-preview img {
      display: inline-block;
    }
    @media print {
      .sable-export-container {
        max-width: 100%;
        padding: 0;
      }
      pre, blockquote, table, .sable-mermaid-preview, .sable-math-block-preview {
        break-inside: avoid;
      }
      h1, h2, h3, h4 {
        break-after: avoid;
      }
    }
  </style>
</head>
<body>
  <article class="sable-editor-surface sable-export-container">
    ${container.innerHTML}
  </article>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
