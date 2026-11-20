import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Mark, MarkType, Node as PMNode } from 'prosemirror-model'
import { sableSchema } from '../schema/sableSchema'
import { isImeComposing } from './imeGuard'

export const inlineSyntaxRevealKey = new PluginKey<{ enabled: boolean }>('sable-inline-reveal')

function findMarkSpanInParent(
  parent: PMNode,
  parentStartPos: number,
  cursorOffsetInParent: number,
  markType: MarkType
): { from: number; to: number; mark: Mark } | null {
  const spans: Array<{ from: number; to: number; mark: Mark }> = []
  let currentSpan: { from: number; to: number; mark: Mark } | null = null

  parent.forEach((child, offset) => {
    const found = child.marks.find((m) => m.type === markType)
    const absFrom = parentStartPos + offset
    const absTo = absFrom + child.nodeSize
    if (found) {
      if (currentSpan && currentSpan.to === absFrom && found.eq(currentSpan.mark)) {
        currentSpan.to = absTo
      } else {
        if (currentSpan) spans.push(currentSpan)
        currentSpan = { from: absFrom, to: absTo, mark: found }
      }
    } else if (currentSpan) {
      spans.push(currentSpan)
      currentSpan = null
    }
  })
  if (currentSpan) spans.push(currentSpan)

  const absCursor = parentStartPos + cursorOffsetInParent
  for (const span of spans) {
    if (absCursor >= span.from && absCursor <= span.to) {
      return span
    }
  }
  return null
}

function makeSyntaxWidget(
  text: string,
  extraClass = '',
  onClick?: (e: MouseEvent) => void
): HTMLElement {
  const el = document.createElement('span')
  el.className = `sable-syntax-marker ${extraClass}`.trim()
  el.textContent = text
  el.contentEditable = 'false'
  if (onClick) {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      onClick(e)
    })
  }
  return el
}

const MARK_SYNTAX: Array<{
  type: MarkType
  open: (mark: Mark) => string
  close: (mark: Mark) => string
}> = [
  { type: sableSchema.marks.strong, open: () => '**', close: () => '**' },
  { type: sableSchema.marks.em, open: () => '*', close: () => '*' },
  { type: sableSchema.marks.strike, open: () => '~~', close: () => '~~' },
  { type: sableSchema.marks.code, open: () => '`', close: () => '`' },
  {
    type: sableSchema.marks.link,
    open: () => '[',
    close: (mark) => `](${mark.attrs.href || ''})`
  }
]

export function createInlineSyntaxRevealPlugin(
  getEnabled: () => boolean,
  onEditLink?: (pos: { from: number; to: number; href: string }) => void
): Plugin {
  return new Plugin({
    key: inlineSyntaxRevealKey,
    props: {
      decorations(state) {
        if (!getEnabled() || isImeComposing(state)) {
          return DecorationSet.empty
        }
        const { selection } = state
        if (!selection.empty) {
          return DecorationSet.empty
        }

        const $from = selection.$from
        const parent = $from.parent
        if (!parent.isTextblock || parent.type === sableSchema.nodes.code_block) {
          return DecorationSet.empty
        }

        const parentStart = $from.start()
        const offset = $from.parentOffset
        const decos: Decoration[] = []

        for (const spec of MARK_SYNTAX) {
          const span = findMarkSpanInParent(parent, parentStart, offset, spec.type)
          if (!span) continue

          const openText = spec.open(span.mark)
          const closeText = spec.close(span.mark)
          const isLink = spec.type === sableSchema.marks.link

          decos.push(
            Decoration.widget(
              span.from,
              () => makeSyntaxWidget(openText),
              { side: -1, key: `open-${spec.type.name}-${span.from}` }
            )
          )

          decos.push(
            Decoration.widget(
              span.to,
              () =>
                makeSyntaxWidget(
                  closeText,
                  isLink ? 'sable-syntax-link-url' : '',
                  isLink && onEditLink
                    ? () =>
                        onEditLink({
                          from: span.from,
                          to: span.to,
                          href: span.mark.attrs.href || ''
                        })
                    : undefined
                ),
              { side: 1, key: `close-${spec.type.name}-${span.to}` }
            )
          )
        }

        if (decos.length === 0) return DecorationSet.empty
        return DecorationSet.create(state.doc, decos)
      }
    }
  })
}
