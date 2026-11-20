import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { sableSchema } from '../schema/sableSchema'

export const focusModePluginKey = new PluginKey('sable-focus-typewriter')

export function createFocusAndTypewriterPlugin(options: {
  getFocusMode: () => boolean
  getTypewriterMode: () => boolean
  getScrollContainer: () => HTMLElement | null
}): Plugin {
  return new Plugin({
    key: focusModePluginKey,
    props: {
      decorations(state) {
        if (!options.getFocusMode()) {
          return DecorationSet.empty
        }
        const { $from } = state.selection
        if ($from.depth < 1) {
          return DecorationSet.empty
        }
        const topBlockStart = $from.before(1)
        const topBlockNode = state.doc.nodeAt(topBlockStart)
        if (!topBlockNode) {
          return DecorationSet.empty
        }
        const topBlockEnd = topBlockStart + topBlockNode.nodeSize
        return DecorationSet.create(state.doc, [
          Decoration.node(topBlockStart, topBlockEnd, {
            class: 'sable-focused-block'
          })
        ])
      }
    },
    view() {
      return {
        update(view, prevState) {
          if (!options.getTypewriterMode()) return
          const selectionChanged = !prevState.selection.eq(view.state.selection)
          const docChanged = !prevState.doc.eq(view.state.doc)
          if (!selectionChanged && !docChanged) return
          if (!view.hasFocus()) return

          const container = options.getScrollContainer()
          if (!container) return

          requestAnimationFrame(() => {
            if (view.isDestroyed) return
            try {
              const head = view.state.selection.head
              const coords = view.coordsAtPos(head)
              const containerRect = container.getBoundingClientRect()
              const targetY = containerRect.top + containerRect.height * 0.46
              const delta = coords.top - targetY
              if (Math.abs(delta) > 14) {
                container.scrollTop += delta
              }
            } catch {
              // Ignore transient coordinate lookup errors
            }
          })
        }
      }
    }
  })
}

export function createTaskCheckboxClickPlugin(): Plugin {
  return new Plugin({
    props: {
      handleClickOn(view, _pos, node, nodePos, event) {
        if (node.type !== sableSchema.nodes.list_item || node.attrs.checked === null) {
          return false
        }
        const dom = view.nodeDOM(nodePos) as HTMLElement | null
        if (!dom) return false
        const rect = dom.getBoundingClientRect()
        const clickOffsetX = event.clientX - rect.left
        const clickOffsetY = event.clientY - rect.top
        if (clickOffsetX <= 28 && clickOffsetY <= 32) {
          event.preventDefault()
          const nextChecked = !node.attrs.checked
          const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
            ...node.attrs,
            checked: nextChecked
          })
          view.dispatch(tr)
          return true
        }
        return false
      }
    }
  })
}
