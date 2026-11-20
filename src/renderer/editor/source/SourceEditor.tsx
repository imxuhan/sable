import React, { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { search, searchKeymap, openSearchPanel } from '@codemirror/search'
import { sableCodeMirrorTheme } from '../codeHighlightStyle'

interface SourceEditorProps {
  value: string
  initialScrollRatio?: number
  openFindTrigger?: number
  onChange: (nextMarkdown: string, scrollRatio: number) => void
}

export const SourceEditor: React.FC<SourceEditorProps> = ({
  value,
  initialScrollRatio = 0,
  openFindTrigger = 0,
  onChange
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const internalUpdateRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        EditorView.lineWrapping,
        history(),
        search({ top: true }),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        sableCodeMirrorTheme,
        keymap.of([indentWithTab, ...searchKeymap, ...historyKeymap, ...defaultKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !internalUpdateRef.current) {
            const scroller = update.view.scrollDOM
            const maxScroll = Math.max(1, scroller.scrollHeight - scroller.clientHeight)
            const ratio = scroller.scrollTop / maxScroll
            onChangeRef.current(update.state.doc.toString(), ratio)
          }
        })
      ]
    })

    const view = new EditorView({
      state,
      parent: host
    })
    viewRef.current = view

    requestAnimationFrame(() => {
      if (initialScrollRatio > 0) {
        const scroller = view.scrollDOM
        const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        scroller.scrollTop = maxScroll * initialScrollRatio
      }
      const lineCount = view.state.doc.lines
      const targetLineNum = Math.min(
        lineCount,
        Math.max(1, Math.round(1 + (lineCount - 1) * initialScrollRatio))
      )
      const targetLine = view.state.doc.line(targetLineNum)
      view.dispatch({ selection: { anchor: targetLine.from } })
      view.focus()
    })

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (value !== current) {
      internalUpdateRef.current = true
      view.dispatch({
        changes: {
          from: 0,
          to: current.length,
          insert: value
        }
      })
      internalUpdateRef.current = false
    }
  }, [value])

  useEffect(() => {
    if (openFindTrigger > 0 && viewRef.current) {
      openSearchPanel(viewRef.current)
    }
  }, [openFindTrigger])

  return <div ref={hostRef} className="sable-source-editor-host" />
}
