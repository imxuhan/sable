import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkFrontmatter from 'remark-frontmatter'
import type { Mark, Node as PMNode } from 'prosemirror-model'
import type { Content, PhrasingContent, Root, TableCell as MdastTableCell } from 'mdast'
import { sableSchema } from '../schema/sableSchema'

interface ParsedImgTag {
  src: string
  alt: string
  title: string
  zoom: number | null
  width: number | null
}

export function parseImgHtmlTag(rawHtml: string): ParsedImgTag | null {
  const trimmed = rawHtml.trim()
  if (!/^<img\b[^>]*\/?>$/i.test(trimmed)) {
    return null
  }
  const getAttr = (name: string): string => {
    const regex = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
    const match = regex.exec(trimmed)
    return match ? (match[1] ?? match[2] ?? match[3] ?? '') : ''
  }

  const src = getAttr('src')
  if (!src) return null
  const alt = getAttr('alt')
  const title = getAttr('title')
  const style = getAttr('style')
  const widthStr = getAttr('width')
  const zoomMatch = /zoom\s*:\s*(\d+(?:\.\d+)?)%/i.exec(style)
  const widthStyleMatch = /(?:^|;)\s*width\s*:\s*(\d+)px/i.exec(style)

  const zoom = zoomMatch ? Number(zoomMatch[1]) : null
  const width = widthStr
    ? Number(widthStr.replace(/px$/i, ''))
    : widthStyleMatch
      ? Number(widthStyleMatch[1])
      : null

  return {
    src,
    alt,
    title,
    zoom: Number.isFinite(zoom) ? zoom : null,
    width: Number.isFinite(width) ? width : null
  }
}

const markdownParser = unified()
  .use(remarkParse)
  .use(remarkGfm, { singleTilde: false })
  .use(remarkMath)
  .use(remarkFrontmatter, ['yaml'])

function tokenizeSupAndSubInLine(line: string, baseMarks: readonly Mark[]): PMNode[] {
  if (!line) return []
  const regex = /(\^([^\^\s\n][^\^\n]*?)\^)|((?<!~)~([^~\s\n][^~\n]*?)~(?!~))/g
  const nodes: PMNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(sableSchema.text(line.slice(lastIndex, match.index), baseMarks))
    }
    if (match[2] !== undefined) {
      const supMark = sableSchema.marks.sup.create()
      const cleanMarks = baseMarks.filter((m) => m.type !== sableSchema.marks.sub)
      nodes.push(sableSchema.text(match[2], supMark.addToSet(cleanMarks)))
    } else if (match[4] !== undefined) {
      const subMark = sableSchema.marks.sub.create()
      const cleanMarks = baseMarks.filter((m) => m.type !== sableSchema.marks.sup)
      nodes.push(sableSchema.text(match[4], subMark.addToSet(cleanMarks)))
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < line.length) {
    nodes.push(sableSchema.text(line.slice(lastIndex), baseMarks))
  }
  return nodes
}

function convertTextWithHardBreaks(text: string, marks: readonly Mark[]): PMNode[] {
  if (!text) return []
  const lines = text.split('\n')
  const nodes: PMNode[] = []
  lines.forEach((line, idx) => {
    if (line.length > 0) {
      nodes.push(...tokenizeSupAndSubInLine(line, marks))
    }
    if (idx < lines.length - 1) {
      nodes.push(sableSchema.nodes.hard_break.create())
    }
  })
  return nodes
}

function convertInlineNodes(
  children: PhrasingContent[] | undefined,
  activeMarks: readonly Mark[] = []
): PMNode[] {
  if (!children || children.length === 0) return []
  const result: PMNode[] = []

  for (const child of children) {
    const anyChild = child as PhrasingContent & { type: string; value?: string }
    switch (anyChild.type) {
      case 'text': {
        result.push(...convertTextWithHardBreaks(child.type === 'text' ? child.value : '', activeMarks))
        break
      }
      case 'break': {
        result.push(sableSchema.nodes.hard_break.create())
        break
      }
      case 'strong': {
        const nextMarks = sableSchema.marks.strong.create().addToSet(activeMarks)
        if ('children' in child) {
          result.push(...convertInlineNodes(child.children as PhrasingContent[], nextMarks))
        }
        break
      }
      case 'emphasis': {
        const nextMarks = sableSchema.marks.em.create().addToSet(activeMarks)
        if ('children' in child) {
          result.push(...convertInlineNodes(child.children as PhrasingContent[], nextMarks))
        }
        break
      }
      case 'delete': {
        const nextMarks = sableSchema.marks.strike.create().addToSet(activeMarks)
        if ('children' in child) {
          result.push(...convertInlineNodes(child.children as PhrasingContent[], nextMarks))
        }
        break
      }
      case 'inlineCode': {
        const codeMark = sableSchema.marks.code.create()
        const value = 'value' in child && typeof child.value === 'string' ? child.value : ''
        if (value.length > 0) {
          result.push(sableSchema.text(value, [codeMark]))
        }
        break
      }
      case 'link': {
        if (child.type === 'link') {
          const linkMark = sableSchema.marks.link.create({
            href: child.url || '',
            title: child.title || ''
          })
          const nextMarks = linkMark.addToSet(activeMarks)
          result.push(...convertInlineNodes(child.children as PhrasingContent[], nextMarks))
        }
        break
      }
      case 'image': {
        if (child.type === 'image') {
          result.push(
            sableSchema.nodes.image.create({
              src: child.url || '',
              alt: child.alt || '',
              title: child.title || '',
              zoom: null,
              width: null
            })
          )
        }
        break
      }
      case 'inlineMath': {
        result.push(
          sableSchema.nodes.math_inline.create({
            value: anyChild.value || ''
          })
        )
        break
      }
      case 'footnoteReference': {
        const fnChild = anyChild as PhrasingContent & { identifier?: string; label?: string }
        result.push(
          sableSchema.nodes.footnote_ref.create({
            id: fnChild.label || fnChild.identifier || '1'
          })
        )
        break
      }
      case 'html': {
        const raw = anyChild.value || ''
        if (/^<br\s*\/?>$/i.test(raw.trim())) {
          result.push(sableSchema.nodes.hard_break.create())
        } else {
          const parsedImg = parseImgHtmlTag(raw)
          if (parsedImg) {
            result.push(sableSchema.nodes.image.create(parsedImg))
          } else if (raw) {
            result.push(...convertTextWithHardBreaks(raw, activeMarks))
          }
        }
        break
      }
      default: {
        if ('value' in anyChild && typeof anyChild.value === 'string' && anyChild.value) {
          result.push(...convertTextWithHardBreaks(anyChild.value, activeMarks))
        }
        break
      }
    }
  }

  return result
}

function isTocParagraph(node: Content): boolean {
  if (node.type !== 'paragraph') return false
  if (node.children.length !== 1) return false
  const first = node.children[0]
  if (first.type === 'text' && /^\[toc\]$/i.test(first.value.trim())) {
    return true
  }
  return false
}

function convertBlockNode(node: Content): PMNode[] {
  const anyNode = node as Content & { type: string; value?: string; lang?: string; checked?: boolean | null }

  switch (anyNode.type) {
    case 'paragraph': {
      if (isTocParagraph(node)) {
        return [sableSchema.nodes.toc.create()]
      }
      if (node.type === 'paragraph') {
        const inline = convertInlineNodes(node.children)
        return [sableSchema.nodes.paragraph.create(null, inline)]
      }
      return []
    }

    case 'heading': {
      if (node.type === 'heading') {
        const level = Math.min(6, Math.max(1, node.depth))
        const inline = convertInlineNodes(node.children)
        return [sableSchema.nodes.heading.create({ level }, inline)]
      }
      return []
    }

    case 'blockquote': {
      if (node.type === 'blockquote') {
        const inner = node.children.flatMap((child) => convertBlockNode(child))
        return [
          sableSchema.nodes.blockquote.create(
            null,
            inner.length > 0 ? inner : [sableSchema.nodes.paragraph.create()]
          )
        ]
      }
      return []
    }

    case 'list': {
      if (node.type === 'list') {
        const items = node.children.map((item) => {
          const itemBlocks = item.children.flatMap((c) => convertBlockNode(c))
          let normalizedBlocks = itemBlocks
          if (normalizedBlocks.length === 0) {
            normalizedBlocks = [sableSchema.nodes.paragraph.create()]
          } else if (normalizedBlocks[0].type !== sableSchema.nodes.paragraph) {
            normalizedBlocks = [sableSchema.nodes.paragraph.create(), ...normalizedBlocks]
          }
          const checked = typeof item.checked === 'boolean' ? item.checked : null
          return sableSchema.nodes.list_item.create({ checked }, normalizedBlocks)
        })

        if (node.ordered) {
          return [
            sableSchema.nodes.ordered_list.create({ order: node.start ?? 1 }, items)
          ]
        }
        return [sableSchema.nodes.bullet_list.create(null, items)]
      }
      return []
    }

    case 'code': {
      const lang = (anyNode.lang || '').trim()
      const val = anyNode.value || ''
      if (lang.toLowerCase() === 'mermaid') {
        return [sableSchema.nodes.mermaid_block.create({ value: val })]
      }
      return [
        sableSchema.nodes.code_block.create(
          { language: lang },
          val ? sableSchema.text(val) : undefined
        )
      ]
    }

    case 'math': {
      return [sableSchema.nodes.math_block.create({ value: anyNode.value || '' })]
    }

    case 'thematicBreak': {
      return [sableSchema.nodes.horizontal_rule.create()]
    }

    case 'footnoteDefinition': {
      const fnNode = anyNode as Content & {
        identifier?: string
        label?: string
        children?: Content[]
      }
      const inner = (fnNode.children || []).flatMap((c) => convertBlockNode(c))
      return [
        sableSchema.nodes.footnote_def.create(
          { id: fnNode.label || fnNode.identifier || '1' },
          inner.length > 0 ? inner : [sableSchema.nodes.paragraph.create()]
        )
      ]
    }

    case 'table': {
      if (node.type === 'table') {
        const alignList = node.align || []
        const rows = node.children.map((row, rowIndex) => {
          const cellType =
            rowIndex === 0 ? sableSchema.nodes.table_header : sableSchema.nodes.table_cell
          const cells = row.children.map((cell: MdastTableCell, colIndex: number) => {
            const align = alignList[colIndex] || null
            const inline = convertInlineNodes(cell.children as PhrasingContent[])
            return cellType.create(
              { align },
              sableSchema.nodes.paragraph.create(null, inline)
            )
          })
          return sableSchema.nodes.table_row.create(null, cells)
        })
        if (rows.length > 0) {
          return [sableSchema.nodes.table.create(null, rows)]
        }
      }
      return []
    }

    case 'html': {
      const raw = (anyNode.value || '').trim()
      const parsedImg = parseImgHtmlTag(raw)
      if (parsedImg) {
        return [
          sableSchema.nodes.paragraph.create(null, [sableSchema.nodes.image.create(parsedImg)])
        ]
      }
      if (/^\[toc\]$/i.test(raw)) {
        return [sableSchema.nodes.toc.create()]
      }
      return [
        sableSchema.nodes.paragraph.create(
          null,
          raw ? convertTextWithHardBreaks(raw, []) : undefined
        )
      ]
    }

    default: {
      if (anyNode.value) {
        return [
          sableSchema.nodes.paragraph.create(null, convertTextWithHardBreaks(anyNode.value, []))
        ]
      }
      return []
    }
  }
}

export function markdownToDoc(markdown: string): PMNode {
  const normalized = (markdown || '').replace(/\r\n/g, '\n')
  if (!normalized.trim()) {
    return sableSchema.nodes.doc.create(null, [sableSchema.nodes.paragraph.create()])
  }

  const tree = markdownParser.parse(normalized) as Root
  let frontmatterNode: PMNode | null = null
  const blocks: PMNode[] = []

  tree.children.forEach((child, index) => {
    const anyChild = child as Content & { type: string; value?: string }
    if (index === 0 && anyChild.type === 'yaml') {
      frontmatterNode = sableSchema.nodes.frontmatter.create({
        value: anyChild.value || ''
      })
      return
    }
    blocks.push(...convertBlockNode(child))
  })

  if (blocks.length === 0) {
    blocks.push(sableSchema.nodes.paragraph.create())
  }

  const content = frontmatterNode ? [frontmatterNode, ...blocks] : blocks
  return sableSchema.nodes.doc.create(null, content)
}

function applyMarksToText(text: string, marks: readonly Mark[]): string {
  if (!text) return ''
  const codeMark = marks.find((m) => m.type === sableSchema.marks.code)
  if (codeMark) {
    const usesBacktick = text.includes('`')
    return usesBacktick ? `\`\` ${text} \`\`` : `\`${text}\``
  }

  let output = text
  for (const mark of marks) {
    if (mark.type === sableSchema.marks.strong) {
      output = `**${output}**`
    } else if (mark.type === sableSchema.marks.em) {
      output = `*${output}*`
    } else if (mark.type === sableSchema.marks.strike) {
      output = `~~${output}~~`
    } else if (mark.type === sableSchema.marks.sup) {
      output = `^${output}^`
    } else if (mark.type === sableSchema.marks.sub) {
      output = `~${output}~`
    } else if (mark.type === sableSchema.marks.link) {
      const titlePart = mark.attrs.title ? ` "${mark.attrs.title.replace(/"/g, '\\"')}"` : ''
      output = `[${output}](${mark.attrs.href}${titlePart})`
    }
  }
  return output
}

function serializeInline(parent: PMNode, inTableCell = false): string {
  const parts: string[] = []

  parent.forEach((child) => {
    if (child.isText) {
      let raw = child.text || ''
      if (inTableCell) {
        raw = raw.replace(/\|/g, '\\|')
      }
      parts.push(applyMarksToText(raw, child.marks))
    } else if (child.type === sableSchema.nodes.hard_break) {
      parts.push(inTableCell ? '<br />' : '\n')
    } else if (child.type === sableSchema.nodes.math_inline) {
      const expr = String(child.attrs.value || '').trim()
      parts.push(`$${expr}$`)
    } else if (child.type === sableSchema.nodes.footnote_ref) {
      const fnId = String(child.attrs.id || '1').trim()
      parts.push(`[^${fnId}]`)
    } else if (child.type === sableSchema.nodes.image) {
      const { src, alt, title, zoom, width } = child.attrs
      if (zoom !== null || width !== null) {
        const attrs = [`src="${src}"`, `alt="${(alt || '').replace(/"/g, '&quot;')}"`]
        if (title) attrs.push(`title="${title.replace(/"/g, '&quot;')}"`)
        if (zoom !== null) attrs.push(`style="zoom: ${zoom}%;"`)
        if (width !== null) attrs.push(`width="${width}"`)
        parts.push(`<img ${attrs.join(' ')} />`)
      } else {
        const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : ''
        parts.push(`![${alt || ''}](${src}${titlePart})`)
      }
    }
  })

  return parts.join('')
}

function serializeTable(tableNode: PMNode): string {
  const rows: string[][] = []
  const aligns: Array<'left' | 'center' | 'right' | null> = []

  tableNode.forEach((rowNode, _offset, rowIdx) => {
    const rowCells: string[] = []
    rowNode.forEach((cellNode, _cellOffset, colIdx) => {
      if (rowIdx === 0) {
        aligns.push(cellNode.attrs.align || null)
      }
      const firstPara = cellNode.firstChild
      const cellText = firstPara ? serializeInline(firstPara, true) : ''
      rowCells.push(cellText)
    })
    rows.push(rowCells)
  })

  if (rows.length === 0) return ''
  const colCount = Math.max(...rows.map((r) => r.length), 1)

  const formatRow = (cells: string[]): string => {
    const padded = Array.from({ length: colCount }, (_, i) => cells[i] ?? '')
    return `| ${padded.join(' | ')} |`
  }

  const separatorCells = Array.from({ length: colCount }, (_, i) => {
    const align = aligns[i]
    if (align === 'left') return ':---'
    if (align === 'center') return ':---:'
    if (align === 'right') return '---:'
    return '---'
  })

  const outLines = [formatRow(rows[0]), `| ${separatorCells.join(' | ')} |`]
  for (let i = 1; i < rows.length; i++) {
    outLines.push(formatRow(rows[i]))
  }
  return outLines.join('\n')
}

function indentLines(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `${prefix}${line}` : prefix.trimEnd()))
    .join('\n')
}

function serializeBlock(node: PMNode): string {
  switch (node.type) {
    case sableSchema.nodes.frontmatter:
      return `---\n${String(node.attrs.value || '').replace(/\n$/, '')}\n---`

    case sableSchema.nodes.paragraph:
      return serializeInline(node, false)

    case sableSchema.nodes.heading: {
      const hashes = '#'.repeat(Math.min(6, Math.max(1, Number(node.attrs.level) || 1)))
      return `${hashes} ${serializeInline(node, false)}`
    }

    case sableSchema.nodes.blockquote: {
      const innerBlocks: string[] = []
      node.forEach((child) => innerBlocks.push(serializeBlock(child)))
      const joined = innerBlocks.join('\n\n')
      return joined
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
    }

    case sableSchema.nodes.bullet_list: {
      const items: string[] = []
      node.forEach((itemNode) => {
        const checked = itemNode.attrs.checked
        const taskPrefix = checked === true ? '[x] ' : checked === false ? '[ ] ' : ''
        const marker = `- ${taskPrefix}`
        const subBlocks: string[] = []
        itemNode.forEach((child) => subBlocks.push(serializeBlock(child)))
        const [first = '', ...rest] = subBlocks
        let line = `${marker}${first}`
        if (rest.length > 0) {
          line += '\n' + rest.map((b) => indentLines(b, '  ')).join('\n\n')
        }
        items.push(line)
      })
      return items.join('\n')
    }

    case sableSchema.nodes.ordered_list: {
      const start = Number(node.attrs.order) || 1
      const items: string[] = []
      node.forEach((itemNode, _offset, index) => {
        const marker = `${start + index}. `
        const subBlocks: string[] = []
        itemNode.forEach((child) => subBlocks.push(serializeBlock(child)))
        const [first = '', ...rest] = subBlocks
        let line = `${marker}${first}`
        if (rest.length > 0) {
          line += '\n' + rest.map((b) => indentLines(b, '   ')).join('\n\n')
        }
        items.push(line)
      })
      return items.join('\n')
    }

    case sableSchema.nodes.code_block: {
      const lang = node.attrs.language || ''
      const content = node.textContent || ''
      const fence = content.includes('```') ? '~~~~' : '```'
      return `${fence}${lang}\n${content}\n${fence}`
    }

    case sableSchema.nodes.math_block: {
      const val = String(node.attrs.value || '').replace(/\n$/, '')
      return `$$\n${val}\n$$`
    }

    case sableSchema.nodes.mermaid_block: {
      const val = String(node.attrs.value || '').replace(/\n$/, '')
      return `\`\`\`mermaid\n${val}\n\`\`\``
    }

    case sableSchema.nodes.toc:
      return '[TOC]'

    case sableSchema.nodes.horizontal_rule:
      return '---'

    case sableSchema.nodes.footnote_def: {
      const fnId = String(node.attrs.id || '1').trim()
      const subBlocks: string[] = []
      node.forEach((child) => subBlocks.push(serializeBlock(child)))
      const [first = '', ...rest] = subBlocks
      let line = `[^${fnId}]: ${first}`
      if (rest.length > 0) {
        line += '\n\n' + rest.map((b) => indentLines(b, '    ')).join('\n\n')
      }
      return line
    }

    case sableSchema.nodes.table:
      return serializeTable(node)

    default:
      return node.textContent || ''
  }
}

export function docToMarkdown(doc: PMNode): string {
  const blocks: string[] = []
  doc.forEach((child) => {
    blocks.push(serializeBlock(child))
  })
  if (blocks.length === 1 && blocks[0] === '') {
    return ''
  }
  return blocks.join('\n\n')
}
