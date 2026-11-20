import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule
} from 'prosemirror-inputrules'
import type { MarkType } from 'prosemirror-model'
import { NodeSelection, Plugin, TextSelection } from 'prosemirror-state'
import { sableSchema } from '../schema/sableSchema'
import { isImeComposing } from './imeGuard'

function markInputRule(
  regexp: RegExp,
  markType: MarkType,
  getAttrs?: (match: RegExpMatchArray) => Record<string, unknown>
): InputRule {
  return new InputRule(
    regexp,
    (state, match, start, end) => {
      const $start = state.doc.resolve(start)
      if ($start.parent.type === sableSchema.nodes.code_block) return null
      if ($start.marks().some((m) => m.type === sableSchema.marks.code)) return null

      const fullMatch = match[0]
      const innerText = match[1]
      if (!innerText) return null

      const prefixOffset = fullMatch.indexOf(innerText)
      let actualStart = start
      if (
        prefixOffset > 0 &&
        !fullMatch.startsWith('**') &&
        !fullMatch.startsWith('__') &&
        !fullMatch.startsWith('~~') &&
        !fullMatch.startsWith('`') &&
        !fullMatch.startsWith('[')
      ) {
        actualStart = start + 1
      }

      const attrs = getAttrs ? getAttrs(match) : undefined
      const mark = markType.create(attrs)
      const existingMarks = $start
        .marks()
        .filter((m) => m.type !== markType && !markType.excludes(m.type))
      const tr = state.tr.replaceWith(
        actualStart,
        end,
        sableSchema.text(innerText, [...existingMarks, mark])
      )
      tr.setStoredMarks(existingMarks)
      return tr
    },
    { inCodeMark: false }
  )
}

export function createMarkdownInputRules(): Plugin {
  const headingRule = textblockTypeInputRule(
    /^(#{1,6})\s$/,
    sableSchema.nodes.heading,
    (match) => ({ level: match[1].length })
  )

  const blockquoteRule = wrappingInputRule(/^\s*>\s$/, sableSchema.nodes.blockquote)

  const bulletListRule = wrappingInputRule(/^\s*([-+*])\s$/, sableSchema.nodes.bullet_list)

  const orderedListRule = wrappingInputRule(
    /^(\d+)\.\s$/,
    sableSchema.nodes.ordered_list,
    (match) => ({ order: Number(match[1]) }),
    (match, node) => node.childCount + node.attrs.order === Number(match[1])
  )

  const taskItemRule = new InputRule(/^\s*[-+*]\s\[([ xX])\]\s$/, (state, match, start, end) => {
    const checked = match[1].toLowerCase() === 'x'
    const $start = state.doc.resolve(start)
    const blockRange = $start.blockRange()
    if (!blockRange) return null

    const tr = state.tr.delete(start, end)
    const $pos = tr.doc.resolve(start)
    const listItem = sableSchema.nodes.list_item.create(
      { checked },
      sableSchema.nodes.paragraph.create()
    )
    const bulletList = sableSchema.nodes.bullet_list.create(null, [listItem])
    tr.replaceWith($pos.before(), $pos.after(), bulletList)
    return tr
  })

  const convertBulletToTaskRule = new InputRule(/^\[([ xX])\]\s$/, (state, match, start, end) => {
    const $start = state.doc.resolve(start)
    for (let d = $start.depth; d > 0; d--) {
      const node = $start.node(d)
      if (node.type === sableSchema.nodes.list_item) {
        const itemPos = $start.before(d)
        const checked = match[1].toLowerCase() === 'x'
        const tr = state.tr.delete(start, end)
        tr.setNodeMarkup(itemPos, undefined, { ...node.attrs, checked })
        return tr
      }
    }
    return null
  })

  const codeBlockRule = new InputRule(/^```([\w+-]*)\s$/, (state, match, start, end) => {
    const lang = (match[1] || '').trim()
    const $start = state.doc.resolve(start)
    if (!$start.parent.isTextblock) return null
    const from = $start.before()
    const to = $start.after()
    if (lang.toLowerCase() === 'mermaid') {
      const node = sableSchema.nodes.mermaid_block.create({
        value: 'flowchart LR\n  A[Start] --> B[Done]'
      })
      const tr = state.tr.replaceWith(from, to, node)
      tr.setSelection(NodeSelection.create(tr.doc, from))
      return tr
    }
    const tr = state.tr.replaceWith(end, end, [])
    return tr.replaceWith(from, to, sableSchema.nodes.code_block.create({ language: lang }))
  })

  const mathBlockSpaceRule = new InputRule(/^\$\$\s$/, (state, _match, start) => {
    const $start = state.doc.resolve(start)
    const from = $start.before()
    const to = $start.after()
    const node = sableSchema.nodes.math_block.create({ value: '' })
    const tr = state.tr.replaceWith(from, to, node)
    tr.setSelection(NodeSelection.create(tr.doc, from))
    return tr
  })

  const mathBlockQuadDollarRule = new InputRule(/^\$\$([^$\n]*)\$\$$/, (state, match, start) => {
    const $start = state.doc.resolve(start)
    if ($start.parentOffset !== 0) return null
    const from = $start.before()
    const to = $start.after()
    const formula = (match[1] || '').trim()
    const node = sableSchema.nodes.math_block.create({ value: formula })
    const tr = state.tr.replaceWith(from, to, node)
    if (!formula) {
      tr.setSelection(NodeSelection.create(tr.doc, from))
    }
    return tr
  })

  const hrRule = new InputRule(/^(?:---|___|\*\*\*)\s$/, (state, _match, start) => {
    const $start = state.doc.resolve(start)
    const from = $start.before()
    const to = $start.after()
    return state.tr.replaceWith(from, to, [
      sableSchema.nodes.horizontal_rule.create(),
      sableSchema.nodes.paragraph.create()
    ])
  })

  const tocRule = new InputRule(/^\[toc\]\s$/i, (state, _match, start) => {
    const $start = state.doc.resolve(start)
    const from = $start.before()
    const to = $start.after()
    return state.tr.replaceWith(from, to, [
      sableSchema.nodes.toc.create(),
      sableSchema.nodes.paragraph.create()
    ])
  })

  const strongStarRule = markInputRule(/\*\*([^*]+)\*\*$/, sableSchema.marks.strong)
  const strongUnderRule = markInputRule(/__([^_]+)__$/, sableSchema.marks.strong)
  const emStarRule = markInputRule(/(?:^|[^*])\*([^*]+)\*$/, sableSchema.marks.em)
  const strikeRule = markInputRule(/~~([^~]+)~~$/, sableSchema.marks.strike)
  const inlineCodeRule = markInputRule(/`([^`]+)`$/, sableSchema.marks.code)

  const linkRule = new InputRule(/\[([^\]]+)\]\(([^)]+)\)$/, (state, match, start, end) => {
    const text = match[1]
    const href = match[2].trim()
    const mark = sableSchema.marks.link.create({ href })
    const tr = state.tr.replaceWith(start, end, sableSchema.text(text, [mark]))
    tr.setStoredMarks([])
    return tr
  })

  const imageRule = new InputRule(/!\[([^\]]*)\]\(([^)]+)\)$/, (state, match, start, end) => {
    const alt = match[1] || ''
    const src = match[2].trim()
    return state.tr.replaceWith(
      start,
      end,
      sableSchema.nodes.image.create({ src, alt, title: '', zoom: null, width: null })
    )
  })

  const inlineMathRule = new InputRule(/(?:^|[^$])\$([^$\n]+)\$$/, (state, match, start, end) => {
    const full = match[0]
    const expr = match[1]
    const actualStart = full.startsWith('$') ? start : start + 1
    return state.tr.replaceWith(
      actualStart,
      end,
      sableSchema.nodes.math_inline.create({ value: expr })
    )
  })

  return inputRules({
    rules: [
      headingRule,
      blockquoteRule,
      taskItemRule,
      convertBulletToTaskRule,
      bulletListRule,
      orderedListRule,
      codeBlockRule,
      mathBlockSpaceRule,
      mathBlockQuadDollarRule,
      hrRule,
      tocRule,
      imageRule,
      linkRule,
      strongStarRule,
      strongUnderRule,
      emStarRule,
      strikeRule,
      inlineCodeRule,
      inlineMathRule
    ]
  })
}

export function createMidPairTypingPlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (isImeComposing(newState)) return null
      if (!transactions.some((tr) => tr.docChanged)) return null
      if (transactions.some((tr) => tr.getMeta('sable-mid-pair'))) return null

      const { selection } = newState
      if (!selection.empty) return null
      const $from = selection.$from
      const parent = $from.parent
      if (!parent.isTextblock || parent.type === sableSchema.nodes.code_block) return null
      if ($from.marks().some((m) => m.type === sableSchema.marks.code)) return null

      const parentStart = $from.start()
      const cursorOffset = $from.parentOffset

      // Find contiguous plain unmarked text around cursor
      let textNodeStartOffset = -1
      let textNodeValue = ''
      parent.forEach((child, offset) => {
        if (
          child.isText &&
          child.marks.length === 0 &&
          cursorOffset >= offset &&
          cursorOffset <= offset + child.nodeSize
        ) {
          textNodeStartOffset = offset
          textNodeValue = child.text || ''
        }
      })

      if (textNodeStartOffset === -1 || !textNodeValue) return null
      const localCursor = cursorOffset - textNodeStartOffset

      // Case 1: User typed `` then moved cursor inside (`|`) and typed text -> `text|`
      if (textNodeValue[localCursor] === '`') {
        const beforeSlice = textNodeValue.slice(0, localCursor)
        const openIdx = beforeSlice.lastIndexOf('`')
        if (openIdx !== -1 && openIdx < localCursor - 1) {
          const inner = textNodeValue.slice(openIdx + 1, localCursor)
          if (inner.length > 0 && !inner.includes('`')) {
            const absFrom = parentStart + textNodeStartOffset + openIdx
            const absTo = parentStart + textNodeStartOffset + localCursor + 1
            const codeMark = sableSchema.marks.code.create()
            const tr = newState.tr.replaceWith(absFrom, absTo, sableSchema.text(inner, [codeMark]))
            const nextCursor = absFrom + inner.length
            tr.setSelection(TextSelection.create(tr.doc, nextCursor))
            tr.setStoredMarks([codeMark])
            tr.setMeta('sable-mid-pair', true)
            return tr
          }
        }
      }

      // Case 2: User typed **** then moved cursor inside (**|**) and typed text -> **text|**
      if (textNodeValue.slice(localCursor, localCursor + 2) === '**') {
        const beforeSlice = textNodeValue.slice(0, localCursor)
        const openIdx = beforeSlice.lastIndexOf('**')
        if (openIdx !== -1 && openIdx < localCursor - 2) {
          const inner = textNodeValue.slice(openIdx + 2, localCursor)
          if (inner.length > 0 && !inner.includes('*')) {
            const absFrom = parentStart + textNodeStartOffset + openIdx
            const absTo = parentStart + textNodeStartOffset + localCursor + 2
            const strongMark = sableSchema.marks.strong.create()
            const tr = newState.tr.replaceWith(
              absFrom,
              absTo,
              sableSchema.text(inner, [strongMark])
            )
            const nextCursor = absFrom + inner.length
            tr.setSelection(TextSelection.create(tr.doc, nextCursor))
            tr.setStoredMarks([strongMark])
            tr.setMeta('sable-mid-pair', true)
            return tr
          }
        }
      }

      // Case 3: User typed $$$$ on a line and moved cursor inside ($$|$$) and typed formula -> $$expr|$$
      if (
        textNodeStartOffset === 0 &&
        textNodeValue.startsWith('$$') &&
        textNodeValue.endsWith('$$') &&
        textNodeValue.length > 4 &&
        localCursor === textNodeValue.length - 2
      ) {
        const expr = textNodeValue.slice(2, -2)
        const blockFrom = $from.before()
        const blockTo = $from.after()
        const node = sableSchema.nodes.math_block.create({ value: expr })
        const tr = newState.tr.replaceWith(blockFrom, blockTo, node)
        tr.setSelection(NodeSelection.create(tr.doc, blockFrom))
        tr.setMeta('sable-mid-pair', true)
        return tr
      }

      return null
    }
  })
}
