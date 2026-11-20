import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { EditorState, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { history } from 'prosemirror-history'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { columnResizing, isInTable, tableEditing } from 'prosemirror-tables'
import { Plugin, PluginKey } from 'prosemirror-state'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Columns,
  Italic,
  Link as LinkIcon,
  Plus,
  Rows,
  Strikethrough,
  Trash2,
  X
} from 'lucide-react'
import type { ImageSaveAction, MenuCommand } from '@shared/types'
import { sableSchema } from './schema/sableSchema'
import { docToMarkdown, markdownToDoc } from './markdown/converter'
import { createImeGuardPlugin } from './plugins/imeGuard'
import { createMarkdownInputRules } from './plugins/inputRules'
import {
  createEditorKeymaps,
  getHeadingsFromState,
  insertImageAtCursor,
  setCurrentTableColumnAlign,
  tableActionCommands,
  toggleOrInsertBlock
} from './plugins/commandsAndKeymap'
import { createInlineSyntaxRevealPlugin } from './plugins/inlineSyntaxReveal'
import {
  createFocusAndTypewriterPlugin,
  createTaskCheckboxClickPlugin
} from './plugins/focusAndTypewriterPlugin'
import { CodeBlockNodeView } from './nodeviews/CodeBlockNodeView'
import { MathBlockNodeView, MathInlineNodeView } from './nodeviews/MathNodeViews'
import { MermaidBlockNodeView } from './nodeviews/MermaidBlockNodeView'
import { FrontMatterNodeView, TocNodeView } from './nodeviews/FrontMatterAndTocViews'
import { ImageNodeView } from './nodeviews/ImageNodeView'

export interface LiveEditorHandle {
  executeCommand: (cmd: MenuCommand) => void
  jumpToPos: (pos: number) => void
  getSelectedMarkdownOrAll: () => string
  getSelectedHtmlOrAll: () => string
  focus: () => void
}

interface LiveEditorProps {
  tabId: string
  markdown: string
  docPath: string | null
  initialScrollRatio: number
  inlineSyntaxReveal: boolean
  focusMode: boolean
  typewriterMode: boolean
  showFloatingToolbar: boolean
  enableSlashMenu: boolean
  imageAction: ImageSaveAction
  customImageDir: string
  showFindBar: boolean
  onCloseFindBar: () => void
  onChange: (nextMarkdown: string, scrollRatio: number) => void
  onHeadingsChange: (headings: Array<{ level: number; text: string; pos: number }>) => void
  onOpenDroppedMarkdown?: (filePath: string) => void
}

const searchHighlightKey = new PluginKey<{ query: string }>('sable-live-search')

function createSearchHighlightPlugin(): Plugin<{ query: string }> {
  return new Plugin<{ query: string }>({
    key: searchHighlightKey,
    state: {
      init: () => ({ query: '' }),
      apply(tr, prev) {
        const meta = tr.getMeta(searchHighlightKey)
        if (meta && typeof meta.query === 'string') {
          return { query: meta.query }
        }
        return prev
      }
    },
    props: {
      decorations(state) {
        const query = searchHighlightKey.getState(state)?.query?.trim().toLowerCase()
        if (!query) return DecorationSet.empty
        const decos: Decoration[] = []
        state.doc.descendants((node, pos) => {
          if (!node.isText || !node.text) return
          const lower = node.text.toLowerCase()
          let idx = lower.indexOf(query)
          while (idx !== -1) {
            decos.push(
              Decoration.inline(pos + idx, pos + idx + query.length, {
                class: 'sable-search-match'
              })
            )
            idx = lower.indexOf(query, idx + query.length)
          }
        })
        return DecorationSet.create(state.doc, decos)
      }
    }
  })
}

const SLASH_ITEMS: Array<{ label: string; hint: string; cmd: MenuCommand }> = [
  { label: '一级标题', hint: 'H1', cmd: 'para:heading-1' },
  { label: '二级标题', hint: 'H2', cmd: 'para:heading-2' },
  { label: '三级标题', hint: 'H3', cmd: 'para:heading-3' },
  { label: '插入表格', hint: 'Table', cmd: 'para:table' },
  { label: '代码块', hint: 'Code', cmd: 'para:code-block' },
  { label: '数学公式块', hint: '$$', cmd: 'para:math-block' },
  { label: 'Mermaid 图表', hint: 'Diagram', cmd: 'para:mermaid-block' },
  { label: '任务列表', hint: '- [ ]', cmd: 'para:task-list' },
  { label: '无序列表', hint: '-', cmd: 'para:bullet-list' },
  { label: '有序列表', hint: '1.', cmd: 'para:ordered-list' },
  { label: '引用块', hint: '>', cmd: 'para:blockquote' },
  { label: '自动目录', hint: '[TOC]', cmd: 'para:toc' },
  { label: '水平分割线', hint: '---', cmd: 'para:hr' }
]

export const LiveEditor = React.forwardRef<LiveEditorHandle, LiveEditorProps>((props, ref) => {
  const {
    tabId,
    markdown,
    docPath,
    initialScrollRatio,
    inlineSyntaxReveal,
    focusMode,
    typewriterMode,
    showFloatingToolbar,
    enableSlashMenu,
    imageAction,
    customImageDir,
    showFindBar,
    onCloseFindBar,
    onChange,
    onHeadingsChange,
    onOpenDroppedMarkdown
  } = props

  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const mountRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const lastEmittedMarkdownRef = useRef<string>(markdown)

  const latestPropsRef = useRef(props)
  latestPropsRef.current = props

  const [tableBarCoords, setTableBarCoords] = useState<{ top: number; left: number } | null>(null)
  const [floatingBarCoords, setFloatingBarCoords] = useState<{ top: number; left: number } | null>(
    null
  )
  const [slashState, setSlashState] = useState<{
    top: number
    left: number
    filter: string
    blockFrom: number
    blockTo: number
  } | null>(null)

  const [linkDialog, setLinkDialog] = useState<{
    from: number
    to: number
    text: string
    href: string
  } | null>(null)

  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')

  const openLinkModalForSelection = (overrideRange?: {
    from: number
    to: number
    href: string
  }): void => {
    const view = viewRef.current
    if (!view) return
    const { state } = view
    const from = overrideRange ? overrideRange.from : state.selection.from
    const to = overrideRange ? overrideRange.to : state.selection.to
    const text = state.doc.textBetween(from, to, ' ')
    let existingHref = overrideRange?.href || ''
    if (!existingHref) {
      const $from = state.doc.resolve(from)
      const linkMark = $from.marks().find((m) => m.type === sableSchema.marks.link)
      if (linkMark) existingHref = linkMark.attrs.href || ''
    }
    setLinkDialog({ from, to, text, href: existingHref || 'https://' })
  }

  const handlePickAndInsertImage = async (): Promise<void> => {
    const view = viewRef.current
    if (!view || !window.sable) return
    const cur = latestPropsRef.current
    const savedSrc = await window.sable.pickAndImportImage(
      cur.docPath,
      cur.imageAction,
      cur.customImageDir
    )
    if (savedSrc) {
      insertImageAtCursor(view, savedSrc, '')
    }
  }

  const updateContextualOverlays = (view: EditorView): void => {
    const container = scrollContainerRef.current
    if (!container || view.isDestroyed) return
    const containerRect = container.getBoundingClientRect()
    const { state } = view

    if (isInTable(state)) {
      const $from = state.selection.$from
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type === sableSchema.nodes.table) {
          const tablePos = $from.before(d)
          const dom = view.nodeDOM(tablePos) as HTMLElement | null
          if (dom) {
            const rect = dom.getBoundingClientRect()
            setTableBarCoords({
              top: rect.top - containerRect.top + container.scrollTop - 36,
              left: Math.max(16, rect.left - containerRect.left)
            })
          }
          break
        }
      }
    } else {
      setTableBarCoords(null)
    }

    if (latestPropsRef.current.showFloatingToolbar && !state.selection.empty) {
      try {
        const startCoords = view.coordsAtPos(state.selection.from)
        const endCoords = view.coordsAtPos(state.selection.to)
        const midX = (startCoords.left + endCoords.left) / 2
        setFloatingBarCoords({
          top: Math.max(8, startCoords.top - containerRect.top + container.scrollTop - 44),
          left: Math.max(16, midX - containerRect.left - 110)
        })
      } catch {
        setFloatingBarCoords(null)
      }
    } else {
      setFloatingBarCoords(null)
    }

    if (latestPropsRef.current.enableSlashMenu && state.selection.empty) {
      const $from = state.selection.$from
      if ($from.parent.type === sableSchema.nodes.paragraph) {
        const txt = $from.parent.textContent
        if (/^\/[\w\u4e00-\u9fa5]*$/.test(txt)) {
          try {
            const coords = view.coordsAtPos(state.selection.from)
            setSlashState({
              top: coords.bottom - containerRect.top + container.scrollTop + 6,
              left: Math.max(16, coords.left - containerRect.left),
              filter: txt.slice(1).toLowerCase(),
              blockFrom: $from.start(),
              blockTo: $from.end()
            })
            return
          } catch {
            // ignore
          }
        }
      }
    }
    setSlashState(null)
  }

  useEffect(() => {
    const mountEl = mountRef.current
    if (!mountEl) return

    const initialDoc = markdownToDoc(markdown)
    lastEmittedMarkdownRef.current = markdown

    const state = EditorState.create({
      doc: initialDoc,
      schema: sableSchema,
      plugins: [
        createImeGuardPlugin(),
        history(),
        createMarkdownInputRules(),
        ...createEditorKeymaps({
          onRequestLinkDialog: () => openLinkModalForSelection(),
          onRequestPickImage: () => void handlePickAndInsertImage()
        }),
        createInlineSyntaxRevealPlugin(
          () => latestPropsRef.current.inlineSyntaxReveal,
          (range) => openLinkModalForSelection(range)
        ),
        createFocusAndTypewriterPlugin({
          getFocusMode: () => latestPropsRef.current.focusMode,
          getTypewriterMode: () => latestPropsRef.current.typewriterMode,
          getScrollContainer: () => scrollContainerRef.current
        }),
        createTaskCheckboxClickPlugin(),
        createSearchHighlightPlugin(),
        columnResizing(),
        tableEditing(),
        dropCursor({ color: 'var(--sable-accent, #2563eb)', width: 2 }),
        gapCursor()
      ]
    })

    const view = new EditorView(mountEl, {
      state,
      nodeViews: {
        code_block: (node, v, getPos) => new CodeBlockNodeView(node, v, getPos),
        math_block: (node, v, getPos) => new MathBlockNodeView(node, v, getPos),
        math_inline: (node, v, getPos) => new MathInlineNodeView(node, v, getPos),
        mermaid_block: (node, v, getPos) => new MermaidBlockNodeView(node, v, getPos),
        frontmatter: (node, v, getPos) => new FrontMatterNodeView(node, v, getPos),
        toc: (node, v) => new TocNodeView(node, v),
        image: (node, v, getPos) =>
          new ImageNodeView(node, v, getPos, () => latestPropsRef.current.docPath)
      },
      handleClick(v, _pos, event) {
        const target = event.target as HTMLElement | null
        const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
        if (anchor && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          const href = anchor.getAttribute('href') || ''
          if (href.startsWith('#')) {
            const headings = getHeadingsFromState(v.state)
            const slug = href.slice(1).toLowerCase()
            const match = headings.find((h) => h.text.toLowerCase().includes(slug))
            if (match) {
              v.dispatch(
                v.state.tr
                  .setSelection(TextSelection.near(v.state.doc.resolve(match.pos + 1)))
                  .scrollIntoView()
              )
            }
          } else if (window.sable) {
            void window.sable.openExternal(href)
          }
          return true
        }
        return false
      },
      handlePaste(v, event) {
        const items = event.clipboardData?.items
        if (!items || !window.sable) return false

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const cur = latestPropsRef.current
            const file = item.getAsFile()
            const fileWithPath = file as (File & { path?: string }) | null
            if (fileWithPath?.path) {
              void window.sable
                .importImageFile(
                  fileWithPath.path,
                  cur.docPath,
                  cur.imageAction,
                  cur.customImageDir
                )
                .then((savedPath) => {
                  if (savedPath && !v.isDestroyed) {
                    insertImageAtCursor(v, savedPath, '')
                  }
                })
            } else {
              void window.sable
                .saveClipboardImage(cur.docPath, cur.imageAction, cur.customImageDir)
                .then((savedPath) => {
                  if (savedPath && !v.isDestroyed) {
                    insertImageAtCursor(v, savedPath, '')
                  }
                })
            }
            return true
          }
        }
        return false
      },
      handleDrop(v, event) {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0 || !window.sable) return false

        for (const f of Array.from(files)) {
          const filePath = (f as File & { path?: string }).path
          if (!filePath) continue
          if (/\.(md|markdown|mdown|mkd|txt)$/i.test(filePath)) {
            event.preventDefault()
            latestPropsRef.current.onOpenDroppedMarkdown?.(filePath)
            return true
          }
          if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(filePath)) {
            event.preventDefault()
            const cur = latestPropsRef.current
            const dropCoords = v.posAtCoords({ left: event.clientX, top: event.clientY })
            void window.sable
              .importImageFile(filePath, cur.docPath, cur.imageAction, cur.customImageDir)
              .then((savedSrc) => {
                if (!savedSrc || v.isDestroyed) return
                const imgNode = sableSchema.nodes.image.create({
                  src: savedSrc,
                  alt: f.name.replace(/\.[^.]+$/, '')
                })
                const pos = dropCoords ? dropCoords.pos : v.state.selection.from
                v.dispatch(v.state.tr.insert(pos, imgNode).scrollIntoView())
              })
            return true
          }
        }
        return false
      },
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction)
        view.updateState(newState)
        updateContextualOverlays(view)

        if (transaction.docChanged) {
          const serialized = docToMarkdown(newState.doc)
          lastEmittedMarkdownRef.current = serialized
          const scroller = scrollContainerRef.current
          const maxScroll = scroller
            ? Math.max(1, scroller.scrollHeight - scroller.clientHeight)
            : 1
          const ratio = scroller ? scroller.scrollTop / maxScroll : 0
          latestPropsRef.current.onChange(serialized, ratio)
          latestPropsRef.current.onHeadingsChange(getHeadingsFromState(newState))
        }
      }
    })

    viewRef.current = view
    latestPropsRef.current.onHeadingsChange(getHeadingsFromState(view.state))

    requestAnimationFrame(() => {
      const scroller = scrollContainerRef.current
      if (scroller && initialScrollRatio > 0) {
        const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
        scroller.scrollTop = maxScroll * initialScrollRatio
      }
      view.focus()
    })

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [tabId])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.isDestroyed) return
    if (markdown !== lastEmittedMarkdownRef.current) {
      const nextDoc = markdownToDoc(markdown)
      lastEmittedMarkdownRef.current = markdown
      const nextState = EditorState.create({
        doc: nextDoc,
        schema: sableSchema,
        plugins: view.state.plugins
      })
      view.updateState(nextState)
      onHeadingsChange(getHeadingsFromState(nextState))
    }
  }, [markdown])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.isDestroyed) return
    view.dispatch(view.state.tr)
  }, [inlineSyntaxReveal, focusMode, docPath])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.isDestroyed) return
    const query = showFindBar ? findQuery : ''
    view.dispatch(view.state.tr.setMeta(searchHighlightKey, { query }))
  }, [findQuery, showFindBar])

  useImperativeHandle(ref, () => ({
    executeCommand(cmd: MenuCommand) {
      const view = viewRef.current
      if (!view) return
      toggleOrInsertBlock(view, cmd, {
        onRequestLinkDialog: () => openLinkModalForSelection(),
        onRequestPickImage: () => void handlePickAndInsertImage()
      })
      view.focus()
    },
    jumpToPos(pos: number) {
      const view = viewRef.current
      if (!view) return
      const clamped = Math.min(Math.max(1, pos + 1), view.state.doc.content.size)
      const tr = view.state.tr
        .setSelection(TextSelection.near(view.state.doc.resolve(clamped)))
        .scrollIntoView()
      view.dispatch(tr)
      view.focus()
    },
    getSelectedMarkdownOrAll() {
      const view = viewRef.current
      if (!view) return markdown
      const { selection, doc } = view.state
      if (selection.empty) return docToMarkdown(doc)
      const slice = selection.content()
      const wrapperDoc = sableSchema.nodes.doc.create(
        null,
        slice.content.firstChild?.isBlock
          ? slice.content
          : [sableSchema.nodes.paragraph.create(null, slice.content)]
      )
      return docToMarkdown(wrapperDoc)
    },
    getSelectedHtmlOrAll() {
      const mountEl = mountRef.current
      if (!mountEl) return ''
      const pmRoot = mountEl.querySelector('.ProseMirror')
      return pmRoot ? pmRoot.innerHTML : ''
    },
    focus() {
      viewRef.current?.focus()
    }
  }))

  const applyLinkDialog = (e: React.FormEvent): void => {
    e.preventDefault()
    const view = viewRef.current
    if (!view || !linkDialog) return
    const { from, to, text, href } = linkDialog
    const trimmedHref = href.trim()
    if (!trimmedHref) {
      view.dispatch(view.state.tr.removeMark(from, to, sableSchema.marks.link))
    } else {
      const display = text.trim() || trimmedHref
      const linkMark = sableSchema.marks.link.create({ href: trimmedHref })
      const tr = view.state.tr.replaceWith(from, to, sableSchema.text(display, [linkMark]))
      view.dispatch(tr)
    }
    setLinkDialog(null)
    view.focus()
  }

  const findNextMatch = (direction: 1 | -1): void => {
    const view = viewRef.current
    const q = findQuery.trim().toLowerCase()
    if (!view || !q) return
    const matches: Array<{ from: number; to: number }> = []
    view.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return
      const lower = node.text.toLowerCase()
      let idx = lower.indexOf(q)
      while (idx !== -1) {
        matches.push({ from: pos + idx, to: pos + idx + q.length })
        idx = lower.indexOf(q, idx + q.length)
      }
    })
    if (matches.length === 0) return
    const curPos = view.state.selection.to
    let target = matches[0]
    if (direction === 1) {
      target = matches.find((m) => m.from >= curPos) || matches[0]
    } else {
      const before = matches.filter((m) => m.to <= view.state.selection.from)
      target = before.length > 0 ? before[before.length - 1] : matches[matches.length - 1]
    }
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, target.from, target.to))
        .scrollIntoView()
    )
  }

  const replaceCurrentMatch = (): void => {
    const view = viewRef.current
    const q = findQuery.trim().toLowerCase()
    if (!view || !q) return
    const { from, to } = view.state.selection
    const selected = view.state.doc.textBetween(from, to, '')
    if (selected.toLowerCase() === q) {
      view.dispatch(view.state.tr.insertText(replaceQuery, from, to))
    }
    findNextMatch(1)
  }

  const filteredSlashItems = slashState
    ? SLASH_ITEMS.filter(
        (item) =>
          !slashState.filter ||
          item.label.toLowerCase().includes(slashState.filter) ||
          item.hint.toLowerCase().includes(slashState.filter)
      )
    : []

  return (
    <div
      ref={scrollContainerRef}
      className={`sable-scroll-container relative flex-1 overflow-y-auto ${focusMode ? 'sable-focus-mode' : ''} ${typewriterMode ? 'sable-typewriter-mode' : ''}`}
      onClick={(e) => {
        if (e.target === scrollContainerRef.current) {
          viewRef.current?.focus()
        }
      }}
    >
      {showFindBar && (
        <div className="sticky top-3 z-30 mx-auto flex max-w-xl items-center gap-2 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-800/95">
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') findNextMatch(e.shiftKey ? -1 : 1)
              if (e.key === 'Escape') onCloseFindBar()
            }}
            placeholder="查找内容..."
            autoFocus
            className="w-40 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-neutral-600"
          />
          <input
            type="text"
            value={replaceQuery}
            onChange={(e) => setReplaceQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') replaceCurrentMatch()
              if (e.key === 'Escape') onCloseFindBar()
            }}
            placeholder="替换为..."
            className="w-36 rounded border border-neutral-300 bg-transparent px-2 py-1 text-xs outline-none focus:border-blue-500 dark:border-neutral-600"
          />
          <button
            type="button"
            onClick={() => findNextMatch(-1)}
            className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            上一个
          </button>
          <button
            type="button"
            onClick={() => findNextMatch(1)}
            className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            下一个
          </button>
          <button
            type="button"
            onClick={replaceCurrentMatch}
            className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            替换
          </button>
          <button
            type="button"
            onClick={onCloseFindBar}
            className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {tableBarCoords && viewRef.current && (
        <div
          style={{ top: tableBarCoords.top, left: tableBarCoords.left }}
          className="sable-overlay-pill absolute z-20 flex items-center gap-0.5 rounded-md border px-1.5 py-1 text-xs shadow-sm"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            title="在上方插入行"
            onClick={() => {
              const v = viewRef.current!
              tableActionCommands.addRowBefore(v.state, v.dispatch)
            }}
            className="sable-pill-btn"
          >
            <Rows className="h-3.5 w-3.5" />
            <span>+行</span>
          </button>
          <button
            type="button"
            title="在下方插入行"
            onClick={() => {
              const v = viewRef.current!
              tableActionCommands.addRowAfter(v.state, v.dispatch)
            }}
            className="sable-pill-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>下行</span>
          </button>
          <button
            type="button"
            title="删除当前行"
            onClick={() => {
              const v = viewRef.current!
              tableActionCommands.deleteRow(v.state, v.dispatch)
            }}
            className="sable-pill-btn"
          >
            <span>删行</span>
          </button>
          <span className="mx-1 h-3.5 w-px bg-neutral-300 dark:bg-neutral-600" />
          <button
            type="button"
            title="在右侧插入列"
            onClick={() => {
              const v = viewRef.current!
              tableActionCommands.addColumnAfter(v.state, v.dispatch)
            }}
            className="sable-pill-btn"
          >
            <Columns className="h-3.5 w-3.5" />
            <span>+列</span>
          </button>
          <button
            type="button"
            title="删除当前列"
            onClick={() => {
              const v = viewRef.current!
              tableActionCommands.deleteColumn(v.state, v.dispatch)
            }}
            className="sable-pill-btn"
          >
            <span>删列</span>
          </button>
          <span className="mx-1 h-3.5 w-px bg-neutral-300 dark:bg-neutral-600" />
          <button
            type="button"
            title="当前列左对齐"
            onClick={() => setCurrentTableColumnAlign(viewRef.current!, 'left')}
            className="sable-pill-btn"
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="当前列居中对齐"
            onClick={() => setCurrentTableColumnAlign(viewRef.current!, 'center')}
            className="sable-pill-btn"
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="当前列右对齐"
            onClick={() => setCurrentTableColumnAlign(viewRef.current!, 'right')}
            className="sable-pill-btn"
          >
            <AlignRight className="h-3.5 w-3.5" />
          </button>
          <span className="mx-1 h-3.5 w-px bg-neutral-300 dark:bg-neutral-600" />
          <button
            type="button"
            title="删除整张表格"
            onClick={() => {
              const v = viewRef.current!
              tableActionCommands.deleteTable(v.state, v.dispatch)
              setTableBarCoords(null)
            }}
            className="sable-pill-btn text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {floatingBarCoords && showFloatingToolbar && viewRef.current && (
        <div
          style={{ top: floatingBarCoords.top, left: floatingBarCoords.left }}
          className="sable-overlay-pill absolute z-30 flex items-center gap-1 rounded-lg border px-2 py-1 shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => toggleOrInsertBlock(viewRef.current!, 'format:strong')}
            className="sable-pill-btn"
            title="加粗 (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleOrInsertBlock(viewRef.current!, 'format:em')}
            className="sable-pill-btn"
            title="斜体 (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleOrInsertBlock(viewRef.current!, 'format:strike')}
            className="sable-pill-btn"
            title="删除线"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleOrInsertBlock(viewRef.current!, 'format:code')}
            className="sable-pill-btn"
            title="行内代码"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openLinkModalForSelection()}
            className="sable-pill-btn"
            title="超链接 (Ctrl+K)"
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {slashState && enableSlashMenu && filteredSlashItems.length > 0 && (
        <div
          style={{ top: slashState.top, left: slashState.left }}
          className="sable-overlay-pill absolute z-30 w-52 overflow-hidden rounded-lg border py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filteredSlashItems.map((item) => (
            <button
              key={item.cmd}
              type="button"
              onClick={() => {
                const v = viewRef.current
                if (!v) return
                const tr = v.state.tr.delete(slashState.blockFrom, slashState.blockTo)
                v.dispatch(tr)
                toggleOrInsertBlock(v, item.cmd)
                setSlashState(null)
                v.focus()
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700/70"
            >
              <span>{item.label}</span>
              <span className="font-mono text-[11px] opacity-60">{item.hint}</span>
            </button>
          ))}
        </div>
      )}

      {linkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <form
            onSubmit={applyLinkDialog}
            className="w-96 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <div className="mb-3 text-sm font-semibold">编辑超链接</div>
            <label className="mb-2 block text-xs text-neutral-500 dark:text-neutral-400">
              显示文本
              <input
                type="text"
                value={linkDialog.text}
                onChange={(e) => setLinkDialog({ ...linkDialog, text: e.target.value })}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-600"
              />
            </label>
            <label className="mb-4 block text-xs text-neutral-500 dark:text-neutral-400">
              链接地址 (URL)
              <input
                type="text"
                value={linkDialog.href}
                onChange={(e) => setLinkDialog({ ...linkDialog, href: e.target.value })}
                autoFocus
                className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-neutral-600"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setLinkDialog(null)
                  viewRef.current?.focus()
                }}
                className="rounded-md px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
              >
                确定
              </button>
            </div>
          </form>
        </div>
      )}

      <div ref={mountRef} className="sable-editor-surface" />
    </div>
  )
})

LiveEditor.displayName = 'LiveEditor'
