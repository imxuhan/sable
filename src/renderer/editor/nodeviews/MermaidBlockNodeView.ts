import mermaid from 'mermaid'
import type { Node as PMNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView } from 'prosemirror-view'

let mermaidInitialized = false
let mermaidCounter = 0

function ensureMermaidInit(): void {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default'
    })
    mermaidInitialized = true
  }
}

export class MermaidBlockNodeView implements NodeView {
  dom: HTMLElement
  private node: PMNode
  private view: EditorView
  private getPos: () => number | undefined
  private previewEl: HTMLElement
  private editorPanel: HTMLElement
  private textarea: HTMLTextAreaElement
  private isEditing = false
  private renderToken = 0

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'sable-mermaid-block-view'
    this.dom.contentEditable = 'false'

    this.previewEl = document.createElement('div')
    this.previewEl.className = 'sable-mermaid-preview'
    this.previewEl.addEventListener('click', (e) => {
      e.stopPropagation()
      this.openEditor()
    })

    this.editorPanel = document.createElement('div')
    this.editorPanel.className = 'sable-mermaid-editor hidden'

    const label = document.createElement('div')
    label.className = 'sable-special-editor-label'
    label.textContent = 'Mermaid 图表源码  ·  按 Ctrl+Enter 或点击外部折叠源码'

    this.textarea = document.createElement('textarea')
    this.textarea.spellcheck = false
    this.textarea.className = 'sable-special-textarea'
    this.textarea.rows = 5
    this.textarea.value = node.attrs.value || ''

    this.textarea.addEventListener('input', () => {
      void this.renderDiagram(this.textarea.value)
    })

    this.textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        this.commitAndClose(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.commitAndClose(false)
      }
    })

    this.textarea.addEventListener('blur', () => {
      setTimeout(() => {
        if (this.isEditing && document.activeElement !== this.textarea) {
          this.commitAndClose(false)
        }
      }, 100)
    })

    this.editorPanel.appendChild(label)
    this.editorPanel.appendChild(this.textarea)

    this.dom.appendChild(this.previewEl)
    this.dom.appendChild(this.editorPanel)

    void this.renderDiagram(node.attrs.value || '')
  }

  private async renderDiagram(source: string): Promise<void> {
    const trimmed = source.trim()
    if (!trimmed) {
      this.previewEl.innerHTML =
        '<span class="sable-placeholder-hint">点击编辑 Mermaid 流程图</span>'
      return
    }
    ensureMermaidInit()
    const currentToken = ++this.renderToken
    const renderId = `sable-mermaid-svg-${++mermaidCounter}`
    try {
      const { svg } = await mermaid.render(renderId, trimmed)
      if (currentToken === this.renderToken) {
        this.previewEl.innerHTML = svg
      }
    } catch (err) {
      const tempErrEl = document.getElementById(`d${renderId}`)
      tempErrEl?.remove()
      if (currentToken === this.renderToken) {
        const msg = err instanceof Error ? err.message.split('\n')[0] : '语法待完善'
        this.previewEl.innerHTML = `<div class="sable-mermaid-error">Mermaid 语法检查提示 (${msg})</div>`
      }
    }
  }

  private openEditor(): void {
    if (this.isEditing) return
    this.isEditing = true
    this.dom.classList.add('is-editing')
    this.editorPanel.classList.remove('hidden')
    this.textarea.value = this.node.attrs.value || ''
    this.textarea.focus()
  }

  private commitAndClose(moveNext: boolean): void {
    if (!this.isEditing) return
    this.isEditing = false
    this.dom.classList.remove('is-editing')
    this.editorPanel.classList.add('hidden')

    const nextValue = this.textarea.value
    const pos = this.getPos()
    if (pos !== undefined) {
      let tr = this.view.state.tr
      if (nextValue !== this.node.attrs.value) {
        tr = tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, value: nextValue })
      }
      if (moveNext) {
        const after = pos + this.node.nodeSize
        if (after >= tr.doc.content.size) {
          const para = this.view.state.schema.nodes.paragraph.create()
          tr = tr.insert(after, para)
          tr = tr.setSelection(TextSelection.create(tr.doc, after + 1))
        } else {
          tr = tr.setSelection(TextSelection.near(tr.doc.resolve(after), 1))
        }
      }
      if (tr.docChanged || tr.selectionSet) {
        this.view.dispatch(tr)
      }
      if (moveNext) {
        this.view.focus()
      }
    }
    void this.renderDiagram(nextValue)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    if (!this.isEditing) {
      this.textarea.value = node.attrs.value || ''
      void this.renderDiagram(node.attrs.value || '')
    }
    return true
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode')
    this.openEditor()
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode')
    if (this.isEditing) {
      this.commitAndClose(false)
    }
  }

  stopEvent(event: Event): boolean {
    return this.editorPanel.contains(event.target as Node)
  }

  ignoreMutation(): boolean {
    return true
  }
}
