import { Compartment, EditorState as CMEditorState } from '@codemirror/state'
import {
  EditorView as CMEditorView,
  keymap as cmKeymap,
  lineNumbers
} from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { languages } from '@codemirror/language-data'
import type { Node as PMNode } from 'prosemirror-model'
import { Selection, TextSelection } from 'prosemirror-state'
import type { EditorView as PMEditorView, NodeView } from 'prosemirror-view'
import { exitCode } from 'prosemirror-commands'
import { sableCodeMirrorTheme } from '../codeHighlightStyle'

const POPULAR_LANGUAGES = [
  '',
  'typescript',
  'javascript',
  'python',
  'rust',
  'go',
  'java',
  'cpp',
  'c',
  'csharp',
  'bash',
  'powershell',
  'json',
  'yaml',
  'toml',
  'html',
  'css',
  'sql',
  'markdown'
]

export class CodeBlockNodeView implements NodeView {
  dom: HTMLElement
  private node: PMNode
  private view: PMEditorView
  private getPos: () => number | undefined
  private cm: CMEditorView
  private updating = false
  private langCompartment = new Compartment()
  private langInput: HTMLInputElement
  private copyBtn: HTMLButtonElement

  constructor(node: PMNode, view: PMEditorView, getPos: () => number | undefined) {
    this.node = node
    this.view = view
    this.getPos = getPos

    this.dom = document.createElement('div')
    this.dom.className = 'sable-codeblock-wrapper'
    this.dom.contentEditable = 'false'

    const header = document.createElement('div')
    header.className = 'sable-codeblock-header'

    const langContainer = document.createElement('div')
    langContainer.className = 'sable-codeblock-lang-wrap'

    const listId = `sable-langs-${Math.random().toString(36).slice(2, 8)}`
    const dataList = document.createElement('datalist')
    dataList.id = listId
    for (const lang of POPULAR_LANGUAGES) {
      if (!lang) continue
      const opt = document.createElement('option')
      opt.value = lang
      dataList.appendChild(opt)
    }

    this.langInput = document.createElement('input')
    this.langInput.type = 'text'
    this.langInput.spellcheck = false
    this.langInput.className = 'sable-codeblock-lang-input'
    this.langInput.placeholder = '语言'
    this.langInput.value = node.attrs.language || ''
    this.langInput.setAttribute('list', listId)
    this.langInput.addEventListener('change', () => {
      this.setLanguage(this.langInput.value.trim())
    })
    this.langInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.setLanguage(this.langInput.value.trim())
        this.cm.focus()
      }
    })

    langContainer.appendChild(this.langInput)
    langContainer.appendChild(dataList)

    this.copyBtn = document.createElement('button')
    this.copyBtn.type = 'button'
    this.copyBtn.className = 'sable-codeblock-copy-btn'
    this.copyBtn.textContent = '复制'
    this.copyBtn.addEventListener('click', (e) => {
      e.preventDefault()
      void navigator.clipboard.writeText(this.cm.state.doc.toString()).then(() => {
        this.copyBtn.textContent = '已复制'
        setTimeout(() => {
          this.copyBtn.textContent = '复制'
        }, 1200)
      })
    })

    header.appendChild(langContainer)
    header.appendChild(this.copyBtn)

    const editorHost = document.createElement('div')
    editorHost.className = 'sable-codeblock-cm-host'

    this.dom.appendChild(header)
    this.dom.appendChild(editorHost)

    this.cm = new CMEditorView({
      parent: editorHost,
      state: CMEditorState.create({
        doc: this.node.textContent,
        extensions: [
          lineNumbers(),
          sableCodeMirrorTheme,
          this.langCompartment.of([]),
          cmKeymap.of([
            {
              key: 'ArrowUp',
              run: () => this.maybeEscape('line', -1)
            },
            {
              key: 'ArrowLeft',
              run: () => this.maybeEscape('char', -1)
            },
            {
              key: 'ArrowDown',
              run: () => this.maybeEscape('line', 1)
            },
            {
              key: 'ArrowRight',
              run: () => this.maybeEscape('char', 1)
            },
            {
              key: 'Mod-Enter',
              run: () => {
                if (exitCode(this.view.state, this.view.dispatch)) {
                  this.view.focus()
                  return true
                }
                return false
              }
            },
            {
              key: 'Backspace',
              run: () => {
                if (this.cm.state.doc.length === 0) {
                  const pos = this.getPos()
                  if (pos !== undefined) {
                    const tr = this.view.state.tr.replaceWith(
                      pos,
                      pos + this.node.nodeSize,
                      this.view.state.schema.nodes.paragraph.create()
                    )
                    tr.setSelection(TextSelection.create(tr.doc, pos + 1))
                    this.view.dispatch(tr)
                    this.view.focus()
                    return true
                  }
                }
                return false
              }
            },
            indentWithTab,
            ...defaultKeymap
          ]),
          CMEditorView.updateListener.of((update) => this.forwardUpdate(update))
        ]
      })
    })

    void this.loadLanguageExtension(this.node.attrs.language || '')
  }

  private async loadLanguageExtension(langName: string): Promise<void> {
    if (!langName) {
      this.cm.dispatch({ effects: this.langCompartment.reconfigure([]) })
      return
    }
    const found = languages.find(
      (d) =>
        d.name.toLowerCase() === langName.toLowerCase() ||
        d.alias.some((a) => a.toLowerCase() === langName.toLowerCase())
    )
    if (!found) {
      this.cm.dispatch({ effects: this.langCompartment.reconfigure([]) })
      return
    }
    try {
      const support = await found.load()
      this.cm.dispatch({ effects: this.langCompartment.reconfigure(support) })
    } catch {
      this.cm.dispatch({ effects: this.langCompartment.reconfigure([]) })
    }
  }

  private setLanguage(lang: string): void {
    const pos = this.getPos()
    if (pos === undefined) return
    if (lang === this.node.attrs.language) return
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      language: lang
    })
    this.view.dispatch(tr)
    void this.loadLanguageExtension(lang)
  }

  private forwardUpdate(update: import('@codemirror/view').ViewUpdate): void {
    if (this.updating || !this.cm.hasFocus) return
    const pos = this.getPos()
    if (pos === undefined) return
    let offset = pos + 1
    const { main } = update.state.selection
    const selFrom = offset + main.from
    const selTo = offset + main.to
    const pmSel = this.view.state.selection

    if (update.docChanged || pmSel.from !== selFrom || pmSel.to !== selTo) {
      const tr = this.view.state.tr
      update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
        if (text.length) {
          tr.replaceWith(
            offset + fromA,
            offset + toA,
            this.view.state.schema.text(text.toString())
          )
        } else {
          tr.delete(offset + fromA, offset + toA)
        }
        offset += toB - fromB - (toA - fromA)
      })
      tr.setSelection(TextSelection.create(tr.doc, selFrom, selTo))
      this.view.dispatch(tr)
    }
  }

  private maybeEscape(unit: 'line' | 'char', dir: -1 | 1): boolean {
    const { state } = this.cm
    const { main } = state.selection
    if (!main.empty) return false
    let targetLineOrBoundary = false
    if (unit === 'line') {
      const line = state.doc.lineAt(main.head)
      targetLineOrBoundary = dir < 0 ? line.number === 1 : line.number === state.doc.lines
    } else {
      targetLineOrBoundary = dir < 0 ? main.head === 0 : main.head === state.doc.length
    }
    if (!targetLineOrBoundary) return false

    const pos = this.getPos()
    if (pos === undefined) return false
    const targetPos = pos + (dir < 0 ? 0 : this.node.nodeSize)
    const selection = Selection.near(this.view.state.doc.resolve(targetPos), dir)
    const tr = this.view.state.tr.setSelection(selection).scrollIntoView()
    this.view.dispatch(tr)
    this.view.focus()
    return true
  }

  setSelection(anchor: number, head: number): void {
    this.cm.focus()
    this.updating = true
    this.cm.dispatch({ selection: { anchor, head } })
    this.updating = false
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    const prevLang = this.node.attrs.language
    this.node = node
    if (node.attrs.language !== prevLang) {
      this.langInput.value = node.attrs.language || ''
      void this.loadLanguageExtension(node.attrs.language || '')
    }
    const newText = node.textContent
    const curText = this.cm.state.doc.toString()
    if (newText !== curText) {
      let start = 0
      let curEnd = curText.length
      let newEnd = newText.length
      while (start < curEnd && curText.charCodeAt(start) === newText.charCodeAt(start)) {
        ++start
      }
      while (
        curEnd > start &&
        newEnd > start &&
        curText.charCodeAt(curEnd - 1) === newText.charCodeAt(newEnd - 1)
      ) {
        curEnd--
        newEnd--
      }
      this.updating = true
      this.cm.dispatch({
        changes: {
          from: start,
          to: curEnd,
          insert: newText.slice(start, newEnd)
        }
      })
      this.updating = false
    }
    return true
  }

  selectNode(): void {
    this.cm.focus()
  }

  stopEvent(event: Event): boolean {
    return this.dom.contains(event.target as Node)
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    this.cm.destroy()
  }
}
