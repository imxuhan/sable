import type { Node as PMNode } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView } from 'prosemirror-view'
import { sanitizeAndPrepareHtml } from '../markdown/htmlSanitizer'

export class HtmlBlockNodeView implements NodeView {
  dom: HTMLElement
  private node: PMNode
  private view: EditorView
  private getPos: () => number | undefined
  private getDocPath: () => string | null
  private previewEl: HTMLElement
  private editorPanel: HTMLElement
  private textarea: HTMLTextAreaElement
  private isEditing = false

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    getDocPath: () => string | null
  ) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.getDocPath = getDocPath

    this.dom = document.createElement('div')
    this.dom.className = 'sable-html-block-view'
    this.dom.contentEditable = 'false'

    this.previewEl = document.createElement('div')
    this.previewEl.className = 'sable-html-block-preview'
    this.previewEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('summary')) {
        return
      }
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (anchor) {
        e.preventDefault()
        if ((e.ctrlKey || e.metaKey) && typeof window !== 'undefined' && window.sable) {
          e.stopPropagation()
          const href = anchor.getAttribute('href') || ''
          if (href && !href.startsWith('#')) {
            void window.sable.openExternal(href)
          }
          return
        }
      }
      e.stopPropagation()
      this.openEditor()
    })

    this.editorPanel = document.createElement('div')
    this.editorPanel.className = 'sable-html-block-editor hidden'

    const headerLabel = document.createElement('div')
    headerLabel.className = 'sable-special-editor-label'
    headerLabel.textContent = 'HTML 块源码  ·  按 Ctrl+Enter 或点击外部完成'

    this.textarea = document.createElement('textarea')
    this.textarea.spellcheck = false
    this.textarea.className = 'sable-special-textarea'
    this.textarea.rows = Math.min(10, Math.max(2, String(node.attrs.value || '').split('\n').length))
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
      } else if (e.key === 'ArrowDown') {
        const val = this.textarea.value
        const selEnd = this.textarea.selectionEnd
        const onLastLine = !val.slice(selEnd).includes('\n')
        if (onLastLine && this.textarea.selectionStart === selEnd) {
          e.preventDefault()
          this.commitAndClose(true)
        }
      } else if (e.key === 'Backspace' && this.textarea.value.length === 0) {
        e.preventDefault()
        this.isEditing = false
        const pos = this.getPos()
        if (pos !== undefined) {
          const para = this.view.state.schema.nodes.paragraph.create()
          const tr = this.view.state.tr.replaceWith(pos, pos + this.node.nodeSize, para)
          tr.setSelection(TextSelection.create(tr.doc, pos + 1))
          this.view.dispatch(tr)
          this.view.focus()
        }
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
  }

  private renderPreview(rawHtml: string): void {
    const trimmed = rawHtml.trim()
    if (!trimmed) {
      this.previewEl.innerHTML = '<span class="sable-placeholder-hint">点击编辑 HTML 块</span>'
      return
    }

    const resolveUrl =
      typeof window !== 'undefined' && window.sable
        ? (src: string) => window.sable.resolveAssetUrl(src, this.getDocPath())
        : undefined

    const prepared = sanitizeAndPrepareHtml(rawHtml, resolveUrl)
    if (!prepared.trim()) {
      this.previewEl.innerHTML = '<span class="sable-placeholder-hint">空 HTML 块（点击编辑源码）</span>'
      return
    }
    this.previewEl.innerHTML = prepared
  }

  private openEditor(): void {
    if (this.isEditing) return
    this.isEditing = true
    this.dom.classList.add('is-editing')
    this.editorPanel.classList.remove('hidden')
    const val = this.node.attrs.value || ''
    this.textarea.rows = Math.min(12, Math.max(2, val.split('\n').length))
    if (document.activeElement !== this.textarea) {
      this.textarea.value = val
      requestAnimationFrame(() => {
        this.textarea.focus()
      })
    }
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
