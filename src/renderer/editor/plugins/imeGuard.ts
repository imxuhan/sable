import { Plugin, PluginKey, type EditorState } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

export const imePluginKey = new PluginKey<boolean>('sable-ime-guard')

export function isImeComposing(state: EditorState, view?: EditorView | null): boolean {
  if (view?.composing) return true
  return Boolean(imePluginKey.getState(state))
}

export function createImeGuardPlugin(): Plugin<boolean> {
  return new Plugin<boolean>({
    key: imePluginKey,
    state: {
      init: () => false,
      apply(tr, prev) {
        const meta = tr.getMeta(imePluginKey)
        if (typeof meta === 'boolean') return meta
        return prev
      }
    },
    props: {
      handleDOMEvents: {
        compositionstart(view) {
          view.dispatch(view.state.tr.setMeta(imePluginKey, true))
          return false
        },
        compositionend(view) {
          if (!view.isDestroyed) {
            view.dispatch(view.state.tr.setMeta(imePluginKey, false))
          }
          return false
        }
      }
    }
  })
}
