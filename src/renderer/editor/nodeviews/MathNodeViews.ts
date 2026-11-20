import katex from 'katex'
import type { Node as PMNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView } from 'prosemirror-view'

export class MathBlockNodeView implements NodeView {
  dom: HTMLElement
  private node: PMNode
  private view: EditorView
  private getPos: () => number | undefined
  private previewEl: HTMLElement
  private editorPanel: HTMLElement
  private textarea: HTMLTextAreaElement
  private isEditing = false

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'sable-math-block-view'
    this.dom.contentEditable = 'false'

    this.previewEl = document.createElement('div')
    this.previewEl.className = 'sable-math-block-preview'
    this.previewEl.addEventListener('click', (e) => {
      e.stopPropagation()
      this.openEditor()
    })

    this.editorPanel = document.createElement('div')
    this.editorPanel.className = 'sable-math-block-editor hidden'

    const headerLabel = document.createElement('div')
    headerLabel.className = 'sable-special-editor-label'
    headerLabel.textContent = 'LaTeX 公式块 ($$)  ·  按 Ctrl+Enter 或点击外部完成'

    this.textarea = document.createElement('textarea')
    this.textarea.className = 'sable-special-textarea'
    this.textarea.rows = 3
    this.textarea.placeholder = '输入 LaTeX 数学公式，例如 \\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}'
    this.textarea.value = node.attrs.value || ''

    this.textarea.addEventListener('input', () => {
      this.renderPreview(this.textarea.value)
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
      }, 80)
    })

    this.editorPanel.appendChild(headerLabel)
    this.editorPanel.appendChild(this.textarea)

    this.dom.appendChild(this.previewEl)
    this.dom.appendChild(this.editorPanel)

    this.renderPreview(node.attrs.value || '')
    if (!node.attrs.value) {
      setTimeout(() => this.openEditor(), 10)
    }
  }

  private renderPreview(latex: string): void {
    const trimmed = latex.trim()
    if (!trimmed) {
      this.previewEl.innerHTML =
        '<span class="sable-placeholder-hint">点击输入数学公式块 ($$)</span>'
      return
    }
    try {
      this.previewEl.innerHTML = katex.renderToString(trimmed, {
        displayMode: true,
        throwOnError: false,
        strict: false
      })
    } catch (err) {
      this.previewEl.textContent = String(err)
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

  private commitAndClose(moveToNextLine: boolean): void {
    if (!this.isEditing) return
    this.isEditing = false
    this.dom.classList.remove('is-editing')
    this.editorPanel.classList.add('hidden')

    const newValue = this.textarea.value
    const pos = this.getPos()
    if (pos !== undefined) {
      let tr = this.view.state.tr
      if (newValue !== this.node.attrs.value) {
        tr = tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, value: newValue })
      }
      if (moveToNextLine) {
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
      if (moveToNextLine) {
        this.view.focus()
      }
    }
    this.renderPreview(newValue)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    if (!this.isEditing) {
      this.textarea.value = node.attrs.value || ''
      this.renderPreview(node.attrs.value || '')
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

export class MathInlineNodeView implements NodeView {
  dom: HTMLElement
  private node: PMNode
  private view: EditorView
  private getPos: () => number | undefined
  private renderSpan: HTMLElement
  private editWrap: HTMLElement
  private input: HTMLInputElement
  private isEditing = false

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('span')
    this.dom.className = 'sable-math-inline-view'
    this.dom.contentEditable = 'false'

    this.renderSpan = document.createElement('span')
    this.renderSpan.className = 'sable-math-inline-render'
    this.renderSpan.addEventListener('click', (e) => {
      e.stopPropagation()
      this.openEditor()
    })

    this.editWrap = document.createElement('span')
    this.editWrap.className = 'sable-math-inline-edit hidden'

    const openDollar = document.createElement('span')
    openDollar.className = 'sable-syntax-marker'
    openDollar.textContent = '$'

    const closeDollar = document.createElement('span')
    closeDollar.className = 'sable-syntax-marker'
    closeDollar.textContent = '$'

    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.className = 'sable-math-inline-input'
    this.input.value = node.attrs.value || ''

    this.input.addEventListener('input', () => {
      this.syncInputWidth()
    })

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        this.commitAndClose(true)
      }
    })

    this.input.addEventListener('blur', () => {
      setTimeout(() => {
        if (this.isEditing) {
          this.commitAndClose(false)
        }
      }, 60)
    })

    this.editWrap.appendChild(openDollar)
    this.editWrap.appendChild(this.input)
    this.editWrap.appendChild(closeDollar)

    this.dom.appendChild(this.renderSpan)
    this.dom.appendChild(this.editWrap)

    this.renderFormula(node.attrs.value || '')
  }

  private syncInputWidth(): void {
    const len = Math.max(4, this.input.value.length + 1)
    this.input.style.width = `${len}ch`
  }

  private renderFormula(expr: string): void {
    const trimmed = expr.trim()
    if (!trimmed) {
      this.renderSpan.textContent = '$...$'
      return
    }
    try {
      this.renderSpan.innerHTML = katex.renderToString(trimmed, {
        displayMode: false,
        throwOnError: false,
        strict: false
      })
    } catch {
      this.renderSpan.textContent = `$${trimmed}$`
    }
  }

  private openEditor(): void {
    if (this.isEditing) return
    this.isEditing = true
    this.renderSpan.classList.add('hidden')
    this.editWrap.classList.remove('hidden')
    this.input.value = this.node.attrs.value || ''
    this.syncInputWidth()
    this.input.focus()
    this.input.select()
  }

  private commitAndClose(restoreEditorFocus: boolean): void {
    if (!this.isEditing) return
    this.isEditing = false
    this.editWrap.classList.add('hidden')
    this.renderSpan.classList.remove('hidden')

    const nextVal = this.input.value.trim()
    const pos = this.getPos()
    if (pos !== undefined) {
      let tr = this.view.state.tr
      if (!nextVal) {
        tr = tr.delete(pos, pos + this.node.nodeSize)
      } else {
        if (nextVal !== this.node.attrs.value) {
          tr = tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, value: nextVal })
        }
        if (restoreEditorFocus) {
          const after = pos + this.node.nodeSize
          tr = tr.setSelection(TextSelection.create(tr.doc, after))
        }
      }
      if (tr.docChanged || tr.selectionSet) {
        this.view.dispatch(tr)
      }
      if (restoreEditorFocus) {
        this.view.focus()
      }
    }
    this.renderFormula(nextVal)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    if (!this.isEditing) {
      this.renderFormula(node.attrs.value || '')
    }
    return true
  }

  selectNode(): void {
    this.openEditor()
  }

  stopEvent(event: Event): boolean {
    return this.editWrap.contains(event.target as Node)
  }

  ignoreMutation(): boolean {
    return true
  }
}
