import {
  baseKeymap,
  chainCommands,
  exitCode,
  lift,
  setBlockType,
  toggleMark,
  wrapIn
} from 'prosemirror-commands'
import { redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import {
  liftListItem,
  sinkListItem,
  splitListItem,
  wrapInList
} from 'prosemirror-schema-list'
import {
  EditorState,
  NodeSelection,
  TextSelection,
  type Command,
  type Plugin
} from 'prosemirror-state'
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  isInTable
} from 'prosemirror-tables'
import type { EditorView } from 'prosemirror-view'
import type { MenuCommand } from '@shared/types'
import { sableSchema } from '../schema/sableSchema'
import { findMarkSpanInParent } from './inlineSyntaxReveal'

export function createTableNode(rows = 3, cols = 3) {
  const headerCells = Array.from({ length: cols }, (_, i) =>
    sableSchema.nodes.table_header.create(
      { align: null },
      sableSchema.nodes.paragraph.create(null, sableSchema.text(`标题 ${i + 1}`))
    )
  )
  const headerRow = sableSchema.nodes.table_row.create(null, headerCells)
  const bodyRows = Array.from({ length: Math.max(1, rows - 1) }, () =>
    sableSchema.nodes.table_row.create(
      null,
      Array.from({ length: cols }, () =>
        sableSchema.nodes.table_cell.create({ align: null }, sableSchema.nodes.paragraph.create())
      )
    )
  )
  return sableSchema.nodes.table.create(null, [headerRow, ...bodyRows])
}

export function setCurrentTableColumnAlign(
  view: EditorView,
  align: 'left' | 'center' | 'right' | null
): boolean {
  const { state } = view
  if (!isInTable(state)) return false
  const $from = state.selection.$from

  let tableDepth = -1
  let cellDepth = -1
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (
      cellDepth === -1 &&
      (node.type === sableSchema.nodes.table_cell || node.type === sableSchema.nodes.table_header)
    ) {
      cellDepth = d
    }
    if (node.type === sableSchema.nodes.table) {
      tableDepth = d
      break
    }
  }
  if (tableDepth === -1 || cellDepth === -1) return false

  const rowDepth = cellDepth - 1
  const colIndex = $from.index(rowDepth)
  const tableNode = $from.node(tableDepth)
  const tableStart = $from.start(tableDepth)

  const tr = state.tr
  tableNode.forEach((rowNode, rowOffset) => {
    if (colIndex < rowNode.childCount) {
      let cellOffset = 0
      for (let i = 0; i < colIndex; i++) {
        cellOffset += rowNode.child(i).nodeSize
      }
      const cellNode = rowNode.child(colIndex)
      const cellPos = tableStart + rowOffset + 1 + cellOffset
      tr.setNodeMarkup(cellPos, undefined, { ...cellNode.attrs, align })
    }
  })

  view.dispatch(tr)
  return true
}

const handleBlockTriggerOnEnter: Command = (state, dispatch, view) => {
  if (view?.composing) return false
  const { selection } = state
  if (!selection.empty) return false
  const $from = selection.$from
  const parent = $from.parent
  if (parent.type !== sableSchema.nodes.paragraph) return false

  const text = parent.textContent.trim()
  const from = $from.before()
  const to = $from.after()

  const fenceMatch = /^```([\w+-]*)$/.exec(text)
  if (fenceMatch) {
    const lang = fenceMatch[1] || ''
    if (dispatch) {
      if (lang.toLowerCase() === 'mermaid') {
        const node = sableSchema.nodes.mermaid_block.create({
          value: 'flowchart LR\n  A[Start] --> B[Done]'
        })
        const tr = state.tr.replaceWith(from, to, node)
        tr.setSelection(NodeSelection.create(tr.doc, from))
        dispatch(tr.scrollIntoView())
      } else {
        const node = sableSchema.nodes.code_block.create({ language: lang })
        const tr = state.tr.replaceWith(from, to, node)
        tr.setSelection(TextSelection.create(tr.doc, from + 1))
        dispatch(tr.scrollIntoView())
      }
    }
    return true
  }

  if (text === '$$' || text === '$$$$') {
    if (dispatch) {
      const node = sableSchema.nodes.math_block.create({ value: '' })
      const tr = state.tr.replaceWith(from, to, node)
      tr.setSelection(NodeSelection.create(tr.doc, from))
      dispatch(tr.scrollIntoView())
    }
    return true
  }

  if (text === '---' || text === '***' || text === '___') {
    if (dispatch) {
      const hr = sableSchema.nodes.horizontal_rule.create()
      const para = sableSchema.nodes.paragraph.create()
      const tr = state.tr.replaceWith(from, to, [hr, para])
      tr.setSelection(TextSelection.create(tr.doc, from + hr.nodeSize + 1))
      dispatch(tr.scrollIntoView())
    }
    return true
  }

  if (/^\[toc\]$/i.test(text)) {
    if (dispatch) {
      const toc = sableSchema.nodes.toc.create()
      const para = sableSchema.nodes.paragraph.create()
      const tr = state.tr.replaceWith(from, to, [toc, para])
      tr.setSelection(TextSelection.create(tr.doc, from + toc.nodeSize + 1))
      dispatch(tr.scrollIntoView())
    }
    return true
  }

  return false
}

const insertHardBreak: Command = (state, dispatch) => {
  const { hard_break } = sableSchema.nodes
  if (dispatch) {
    dispatch(state.tr.replaceSelectionWith(hard_break.create()).scrollIntoView())
  }
  return true
}

const backspaceHeadingOrQuote: Command = (state, dispatch) => {
  const { selection } = state
  if (!selection.empty) return false
  const $from = selection.$from
  if ($from.parentOffset !== 0) return false
  if ($from.parent.type === sableSchema.nodes.heading) {
    return setBlockType(sableSchema.nodes.paragraph)(state, dispatch)
  }
  return false
}

export function insertImageAtCursor(view: EditorView, src: string, alt = ''): void {
  const imgNode = sableSchema.nodes.image.create({
    src,
    alt,
    title: '',
    zoom: null,
    width: null
  })
  const tr = view.state.tr.replaceSelectionWith(imgNode).scrollIntoView()
  view.dispatch(tr)
  view.focus()
}

export function toggleOrInsertBlock(
  view: EditorView,
  command: MenuCommand,
  callbacks?: {
    onRequestLinkDialog?: () => void
    onRequestPickImage?: () => void
  }
): boolean {
  const { state, dispatch } = view
  const { nodes, marks } = sableSchema

  switch (command) {
    case 'edit:undo':
      return undo(state, dispatch)
    case 'edit:redo':
      return redo(state, dispatch)

    case 'para:heading-1':
    case 'para:heading-2':
    case 'para:heading-3':
    case 'para:heading-4':
    case 'para:heading-5':
    case 'para:heading-6': {
      const level = Number(command.split('-')[1])
      const $from = state.selection.$from
      if ($from.parent.type === nodes.heading && $from.parent.attrs.level === level) {
        return setBlockType(nodes.paragraph)(state, dispatch)
      }
      return setBlockType(nodes.heading, { level })(state, dispatch)
    }

    case 'para:paragraph':
      return setBlockType(nodes.paragraph)(state, dispatch)

    case 'para:heading-promote': {
      const $from = state.selection.$from
      if ($from.parent.type === nodes.heading) {
        const nextLevel = Math.max(1, Number($from.parent.attrs.level) - 1)
        return setBlockType(nodes.heading, { level: nextLevel })(state, dispatch)
      }
      return setBlockType(nodes.heading, { level: 2 })(state, dispatch)
    }

    case 'para:heading-demote': {
      const $from = state.selection.$from
      if ($from.parent.type === nodes.heading) {
        const cur = Number($from.parent.attrs.level)
        if (cur >= 6) {
          return setBlockType(nodes.paragraph)(state, dispatch)
        }
        return setBlockType(nodes.heading, { level: cur + 1 })(state, dispatch)
      }
      return setBlockType(nodes.heading, { level: 1 })(state, dispatch)
    }

    case 'para:blockquote': {
      const $from = state.selection.$from
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type === nodes.blockquote) {
          return lift(state, dispatch)
        }
      }
      return wrapIn(nodes.blockquote)(state, dispatch)
    }

    case 'para:bullet-list':
      return wrapInList(nodes.bullet_list)(state, dispatch)

    case 'para:ordered-list':
      return wrapInList(nodes.ordered_list)(state, dispatch)

    case 'para:task-list': {
      const $from = state.selection.$from
      for (let d = $from.depth; d > 0; d--) {
        const n = $from.node(d)
        if (n.type === nodes.list_item) {
          const pos = $from.before(d)
          const nextChecked = n.attrs.checked === null ? false : null
          dispatch(state.tr.setNodeMarkup(pos, undefined, { ...n.attrs, checked: nextChecked }))
          return true
        }
      }
      const item = nodes.list_item.create({ checked: false }, nodes.paragraph.create())
      const list = nodes.bullet_list.create(null, [item])
      dispatch(state.tr.replaceSelectionWith(list).scrollIntoView())
      return true
    }

    case 'para:table': {
      const tbl = createTableNode(3, 3)
      const para = nodes.paragraph.create()
      const tr = state.tr.replaceSelectionWith(tbl)
      const afterPos = tr.selection.from
      tr.insert(afterPos, para)
      dispatch(tr.scrollIntoView())
      return true
    }

    case 'para:code-block': {
      const node = nodes.code_block.create({ language: '' })
      const tr = state.tr.replaceSelectionWith(node)
      dispatch(tr.scrollIntoView())
      return true
    }

    case 'para:math-block': {
      const node = nodes.math_block.create({ value: '' })
      const from = state.selection.from
      const tr = state.tr.replaceSelectionWith(node)
      const resolvedPos = Math.min(from, tr.doc.content.size - node.nodeSize)
      if (tr.doc.nodeAt(resolvedPos)?.type === nodes.math_block) {
        tr.setSelection(NodeSelection.create(tr.doc, resolvedPos))
      }
      dispatch(tr.scrollIntoView())
      return true
    }

    case 'para:mermaid-block': {
      const node = nodes.mermaid_block.create({
        value: 'flowchart LR\n  A[Start] --> B[Process] --> C[Done]'
      })
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
      return true
    }

    case 'para:toc': {
      const node = nodes.toc.create()
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
      return true
    }

    case 'para:hr': {
      const hr = nodes.horizontal_rule.create()
      dispatch(state.tr.replaceSelectionWith(hr).scrollIntoView())
      return true
    }

    case 'format:strong':
      return toggleMark(marks.strong)(state, dispatch)
    case 'format:em':
      return toggleMark(marks.em)(state, dispatch)
    case 'format:strike':
      return toggleMark(marks.strike)(state, dispatch)
    case 'format:code':
      return toggleMark(marks.code)(state, dispatch)

    case 'format:math-inline': {
      const selectedText = state.doc.textBetween(state.selection.from, state.selection.to, ' ')
      const node = nodes.math_inline.create({ value: selectedText || 'x^2' })
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
      return true
    }

    case 'format:link': {
      if (callbacks?.onRequestLinkDialog) {
        callbacks.onRequestLinkDialog()
        return true
      }
      return false
    }

    case 'format:image': {
      if (callbacks?.onRequestPickImage) {
        callbacks.onRequestPickImage()
        return true
      }
      return false
    }

    case 'format:clear': {
      const { from, to, empty } = state.selection
      if (empty) return false
      const tr = state.tr.removeMark(from, to)
      dispatch(tr)
      return true
    }

    default:
      return false
  }
}

const exitInlineMarkOnArrowRight: Command = (state, dispatch) => {
  const { selection } = state
  if (!selection.empty) return false
  const $from = selection.$from
  const activeMarks = state.storedMarks ?? $from.marks()
  if (activeMarks.length === 0) return false

  const parent = $from.parent
  if (!parent.isTextblock) return false
  const parentStart = $from.start()
  const absCursor = parentStart + $from.parentOffset

  // Check if cursor sits at the right edge of any inline mark span
  const exitingMarks = activeMarks.filter((m) => {
    const span = findMarkSpanInParent(parent, parentStart, $from.parentOffset, m.type)
    return span !== null && absCursor === span.to
  })

  if (exitingMarks.length === 0) return false
  const remainingMarks = activeMarks.filter((m) => !exitingMarks.includes(m))
  if (dispatch) {
    dispatch(state.tr.setStoredMarks(remainingMarks))
  }
  return true
}

export function createEditorKeymaps(callbacks?: {
  onRequestLinkDialog?: () => void
  onRequestPickImage?: () => void
}): Plugin[] {
  const customKeys: Record<string, Command> = {
    'Mod-z': undo,
    'Mod-y': redo,
    'Shift-Mod-z': redo,
    'Mod-b': toggleMark(sableSchema.marks.strong),
    'Mod-i': toggleMark(sableSchema.marks.em),
    'Alt-Shift-5': toggleMark(sableSchema.marks.strike),
    'Mod-`': toggleMark(sableSchema.marks.code),
    'Mod-k': () => {
      callbacks?.onRequestLinkDialog?.()
      return true
    },
    'Mod-1': setBlockType(sableSchema.nodes.heading, { level: 1 }),
    'Mod-2': setBlockType(sableSchema.nodes.heading, { level: 2 }),
    'Mod-3': setBlockType(sableSchema.nodes.heading, { level: 3 }),
    'Mod-4': setBlockType(sableSchema.nodes.heading, { level: 4 }),
    'Mod-5': setBlockType(sableSchema.nodes.heading, { level: 5 }),
    'Mod-6': setBlockType(sableSchema.nodes.heading, { level: 6 }),
    'Mod-0': setBlockType(sableSchema.nodes.paragraph),
    ArrowRight: exitInlineMarkOnArrowRight,
    'Shift-Enter': chainCommands(exitCode, insertHardBreak),
    Enter: chainCommands(
      handleBlockTriggerOnEnter,
      splitListItem(sableSchema.nodes.list_item)
    ),
    Backspace: chainCommands(backspaceHeadingOrQuote, baseKeymap.Backspace),
    Tab: chainCommands(goToNextCell(1), sinkListItem(sableSchema.nodes.list_item)),
    'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(sableSchema.nodes.list_item))
  }

  return [keymap(customKeys), keymap(baseKeymap)]
}

export const tableActionCommands = {
  addRowBefore,
  addRowAfter,
  deleteRow,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  deleteTable
}

export function getHeadingsFromState(
  state: EditorState
): Array<{ level: number; text: string; pos: number }> {
  const headings: Array<{ level: number; text: string; pos: number }> = []
  state.doc.descendants((node, pos) => {
    if (node.type === sableSchema.nodes.heading) {
      headings.push({
        level: Number(node.attrs.level) || 1,
        text: node.textContent || '未命名标题',
        pos
      })
    }
  })
  return headings
}
