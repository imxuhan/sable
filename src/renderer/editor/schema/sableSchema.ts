import { Schema, type DOMOutputSpec, type NodeSpec, type MarkSpec } from 'prosemirror-model'
import { tableNodes } from 'prosemirror-tables'

const tableNodeSpecs = tableNodes({
  tableGroup: 'block',
  cellContent: 'paragraph',
  cellAttributes: {
    align: {
      default: null,
      getFromDOM(dom) {
        const align = (dom as HTMLElement).style.textAlign || dom.getAttribute('align')
        if (align === 'left' || align === 'center' || align === 'right') {
          return align
        }
        return null
      },
      setDOMAttr(value, attrs) {
        if (value) {
          attrs.style = `${attrs.style || ''}text-align: ${value};`
        }
      }
    }
  }
})

const nodes: Record<string, NodeSpec> = {
  doc: {
    content: 'frontmatter? block+'
  },

  frontmatter: {
    attrs: {
      value: { default: '' }
    },
    atom: true,
    isolating: true,
    selectable: true,
    parseDOM: [
      {
        tag: 'div[data-type="frontmatter"]',
        getAttrs(dom) {
          return { value: (dom as HTMLElement).getAttribute('data-value') || '' }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      return [
        'div',
        {
          'data-type': 'frontmatter',
          'data-value': node.attrs.value,
          class: 'sable-frontmatter'
        },
        node.attrs.value
      ]
    }
  },

  paragraph: {
    content: 'inline*',
    group: 'block',
    parseDOM: [{ tag: 'p' }],
    toDOM(): DOMOutputSpec {
      return ['p', 0]
    }
  },

  heading: {
    attrs: { level: { default: 1 } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 2 } },
      { tag: 'h3', attrs: { level: 3 } },
      { tag: 'h4', attrs: { level: 4 } },
      { tag: 'h5', attrs: { level: 5 } },
      { tag: 'h6', attrs: { level: 6 } }
    ],
    toDOM(node): DOMOutputSpec {
      return [`h${node.attrs.level}`, 0]
    }
  },

  blockquote: {
    content: 'block+',
    group: 'block',
    defining: true,
    parseDOM: [{ tag: 'blockquote' }],
    toDOM(): DOMOutputSpec {
      return ['blockquote', 0]
    }
  },

  bullet_list: {
    content: 'list_item+',
    group: 'block',
    parseDOM: [{ tag: 'ul' }],
    toDOM(): DOMOutputSpec {
      return ['ul', 0]
    }
  },

  ordered_list: {
    attrs: { order: { default: 1 } },
    content: 'list_item+',
    group: 'block',
    parseDOM: [
      {
        tag: 'ol',
        getAttrs(dom) {
          const start = (dom as HTMLElement).getAttribute('start')
          return { order: start ? parseInt(start, 10) : 1 }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      return node.attrs.order === 1 ? ['ol', 0] : ['ol', { start: node.attrs.order }, 0]
    }
  },

  list_item: {
    attrs: {
      checked: { default: null }
    },
    content: 'paragraph block*',
    defining: true,
    parseDOM: [
      {
        tag: 'li',
        getAttrs(dom) {
          const el = dom as HTMLElement
          const taskAttr = el.getAttribute('data-checked')
          if (taskAttr === 'true') return { checked: true }
          if (taskAttr === 'false') return { checked: false }
          return { checked: null }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = {}
      if (node.attrs.checked !== null) {
        attrs['data-task-item'] = 'true'
        attrs['data-checked'] = String(Boolean(node.attrs.checked))
        attrs.class = node.attrs.checked ? 'sable-task-item is-checked' : 'sable-task-item'
      }
      return ['li', attrs, 0]
    }
  },

  code_block: {
    attrs: { language: { default: '' } },
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    isolating: true,
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs(dom) {
          const codeEl = (dom as HTMLElement).querySelector('code')
          const cls = codeEl?.getAttribute('class') || ''
          const match = /language-([\w+-]+)/.exec(cls)
          return { language: match ? match[1] : '' }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      const langClass = node.attrs.language ? `language-${node.attrs.language}` : undefined
      return ['pre', { class: 'sable-code-pre' }, ['code', langClass ? { class: langClass } : {}, 0]]
    }
  },

  math_block: {
    attrs: { value: { default: '' } },
    group: 'block',
    atom: true,
    isolating: true,
    selectable: true,
    parseDOM: [
      {
        tag: 'div[data-type="math-block"]',
        getAttrs(dom) {
          return { value: (dom as HTMLElement).getAttribute('data-value') || '' }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      return [
        'div',
        {
          'data-type': 'math-block',
          'data-value': node.attrs.value,
          class: 'sable-math-block'
        },
        node.attrs.value
      ]
    }
  },

  mermaid_block: {
    attrs: { value: { default: 'flowchart LR\n  A[Start] --> B[End]' } },
    group: 'block',
    atom: true,
    isolating: true,
    selectable: true,
    parseDOM: [
      {
        tag: 'div[data-type="mermaid-block"]',
        getAttrs(dom) {
          return { value: (dom as HTMLElement).getAttribute('data-value') || '' }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      return [
        'div',
        {
          'data-type': 'mermaid-block',
          'data-value': node.attrs.value,
          class: 'sable-mermaid-block'
        },
        node.attrs.value
      ]
    }
  },

  toc: {
    group: 'block',
    atom: true,
    selectable: true,
    parseDOM: [{ tag: 'div[data-type="toc"]' }],
    toDOM(): DOMOutputSpec {
      return ['div', { 'data-type': 'toc', class: 'sable-toc-block' }, '[TOC]']
    }
  },

  horizontal_rule: {
    group: 'block',
    atom: true,
    selectable: true,
    parseDOM: [{ tag: 'hr' }],
    toDOM(): DOMOutputSpec {
      return ['hr']
    }
  },

  ...tableNodeSpecs,

  text: {
    group: 'inline'
  },

  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM(): DOMOutputSpec {
      return ['br']
    }
  },

  image: {
    inline: true,
    group: 'inline',
    draggable: true,
    selectable: true,
    attrs: {
      src: { default: '' },
      alt: { default: '' },
      title: { default: '' },
      zoom: { default: null },
      width: { default: null }
    },
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs(dom) {
          const el = dom as HTMLElement
          const style = el.getAttribute('style') || ''
          const zoomMatch = /zoom\s*:\s*(\d+(?:\.\d+)?)%/i.exec(style)
          const widthAttr = el.getAttribute('width')
          return {
            src: el.getAttribute('src') || '',
            alt: el.getAttribute('alt') || '',
            title: el.getAttribute('title') || '',
            zoom: zoomMatch ? Number(zoomMatch[1]) : null,
            width: widthAttr ? Number(widthAttr) : null
          }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = {
        src: node.attrs.src,
        alt: node.attrs.alt || ''
      }
      if (node.attrs.title) attrs.title = node.attrs.title
      if (node.attrs.zoom) attrs.style = `zoom: ${node.attrs.zoom}%;`
      if (node.attrs.width) attrs.width = String(node.attrs.width)
      return ['img', attrs]
    }
  },

  math_inline: {
    inline: true,
    group: 'inline',
    atom: true,
    selectable: true,
    attrs: {
      value: { default: '' }
    },
    parseDOM: [
      {
        tag: 'span[data-type="math-inline"]',
        getAttrs(dom) {
          return { value: (dom as HTMLElement).getAttribute('data-value') || '' }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      return [
        'span',
        {
          'data-type': 'math-inline',
          'data-value': node.attrs.value,
          class: 'sable-math-inline'
        },
        `$${node.attrs.value}$`
      ]
    }
  }
}

const marks: Record<string, MarkSpec> = {
  strong: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (node) => (node as HTMLElement).style.fontWeight !== 'normal' && null }
    ],
    toDOM(): DOMOutputSpec {
      return ['strong', 0]
    }
  },

  em: {
    parseDOM: [
      { tag: 'i' },
      { tag: 'em' },
      { style: 'font-style=italic' }
    ],
    toDOM(): DOMOutputSpec {
      return ['em', 0]
    }
  },

  strike: {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
    toDOM(): DOMOutputSpec {
      return ['del', 0]
    }
  },

  code: {
    excludes: '_',
    parseDOM: [{ tag: 'code' }],
    toDOM(): DOMOutputSpec {
      return ['code', 0]
    }
  },

  link: {
    attrs: {
      href: { default: '' },
      title: { default: '' }
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs(dom) {
          const el = dom as HTMLElement
          return {
            href: el.getAttribute('href') || '',
            title: el.getAttribute('title') || ''
          }
        }
      }
    ],
    toDOM(node): DOMOutputSpec {
      const attrs: Record<string, string> = { href: node.attrs.href }
      if (node.attrs.title) attrs.title = node.attrs.title
      return ['a', attrs, 0]
    }
  }
}

export const sableSchema = new Schema({ nodes, marks })
