import type { Node as PMNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView } from 'prosemirror-view'
import { getHeadingsFromState } from '../plugins/commandsAndKeymap'

export class FrontMatterNodeView implements NodeView {
  dom: HTMLElement
  private node: PMNode
  private view: EditorView
  private getPos: () => number | undefined
  private textarea: HTMLTextAreaElement

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'sable-frontmatter-card'
    this.dom.contentEditable = 'false'

    const badge = document.createElement('div')
    badge.className = 'sable-frontmatter-badge'
    badge.textContent = 'YAML Front Matter'

    this.textarea = document.createElement('textarea')
    this.textarea.className = 'sable-frontmatter-textarea'
    this.textarea.value = node.attrs.value || ''
    this.textarea.rows = Math.max(2, (node.attrs.value || '').split('\n').length)
    this.textarea.placeholder = 'title: 文档标题\ndate: 2026-11-20'

    this.textarea.addEventListener('input', () => {
      this.textarea.rows = Math.max(2, this.textarea.value.split('\n').length)
    })

    this.textarea.addEventListener('blur', () => {
      this.commitValue()
    })

    this.textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        this.commitValue()
        const pos = this.getPos()
        if (pos !== undefined) {
          const after = pos + this.node.nodeSize
          const tr = this.view.state.tr.setSelection(
            TextSelection.near(this.view.state.doc.resolve(after), 1)
          )
          this.view.dispatch(tr)
          this.view.focus()
        }
      }
    })

    this.dom.appendChild(badge)
    this.dom.appendChild(this.textarea)
  }

  private commitValue(): void {
    const pos = this.getPos()
    if (pos === undefined) return
    const nextVal = this.textarea.value
    if (nextVal !== this.node.attrs.value) {
      const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        value: nextVal
      })
      this.view.dispatch(tr)
    }
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    if (document.activeElement !== this.textarea) {
      this.textarea.value = node.attrs.value || ''
      this.textarea.rows = Math.max(2, (node.attrs.value || '').split('\n').length)
    }
    return true
  }

  stopEvent(event: Event): boolean {
    return this.dom.contains(event.target as Node)
  }

  ignoreMutation(): boolean {
    return true
  }
}

export class TocNodeView implements NodeView {
  dom: HTMLElement
  private view: EditorView
  private listEl: HTMLElement
  private intervalId: number

  constructor(_node: PMNode, view: EditorView) {
    this.view = view

    this.dom = document.createElement('div')
    this.dom.className = 'sable-toc-card'
    this.dom.contentEditable = 'false'

    const title = document.createElement('div')
    title.className = 'sable-toc-title'
    title.textContent = '目录'

    this.listEl = document.createElement('div')
    this.listEl.className = 'sable-toc-list'

    this.dom.appendChild(title)
    this.dom.appendChild(this.listEl)

    this.renderHeadings()
    this.intervalId = window.setInterval(() => {
      if (!this.view.isDestroyed) {
        this.renderHeadings()
      }
    }, 600)
  }

  renderHeadings(): void {
    const headings = getHeadingsFromState(this.view.state)
    this.listEl.innerHTML = ''
    if (headings.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'sable-placeholder-hint'
      empty.textContent = '添加标题后自动生成目录 ([TOC])'
      this.listEl.appendChild(empty)
      return
    }

    const minLevel = Math.min(...headings.map((h) => h.level))
    for (const h of headings) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'sable-toc-item'
      item.style.paddingLeft = `${(h.level - minLevel) * 16}px`
      item.textContent = h.text
      item.addEventListener('click', (e) => {
        e.preventDefault()
        const tr = this.view.state.tr.setSelection(
          TextSelection.near(this.view.state.doc.resolve(h.pos + 1))
        )
        this.view.dispatch(tr.scrollIntoView())
        this.view.focus()
      })
      this.listEl.appendChild(item)
    }
  }

  update(node: PMNode): boolean {
    if (node.type.name !== 'toc') return false
    this.renderHeadings()
    return true
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    window.clearInterval(this.intervalId)
  }
}
