import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

export const sableSyntaxHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword], color: 'var(--sable-syn-keyword)' },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: 'var(--sable-code-fg)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: 'var(--sable-syn-func)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--sable-syn-attr)' },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: 'var(--sable-syn-number)' },
  { tag: [t.definition(t.name), t.separator], color: 'var(--sable-code-fg)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--sable-syn-type)' },
  { tag: [t.number, t.changed, t.annotation, t.self, t.bool, t.atom], color: 'var(--sable-syn-number)' },
  { tag: [t.operator, t.url, t.escape, t.regexp, t.link], color: 'var(--sable-syn-operator)' },
  { tag: [t.meta, t.comment], color: 'var(--sable-syn-comment)', fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '650' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.heading, fontWeight: '650', color: 'var(--sable-accent)' },
  { tag: [t.string, t.special(t.brace), t.inserted], color: 'var(--sable-syn-string)' },
  { tag: t.tagName, color: 'var(--sable-syn-keyword)' }
])

export const sableCodeMirrorTheme: Extension = [
  EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--sable-code-fg)',
      fontFamily: 'var(--sable-font-mono)'
    },
    '.cm-scroller': {
      fontFamily: 'var(--sable-font-mono)',
      lineHeight: '1.65'
    },
    '.cm-content': {
      fontFamily: 'var(--sable-font-mono)',
      padding: '10px 0',
      caretColor: 'var(--sable-fg)'
    },
    '.cm-line': {
      padding: '0 16px'
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--sable-muted)',
      border: 'none',
      paddingLeft: '8px',
      opacity: '0.55',
      userSelect: 'none'
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 4px',
      minWidth: '28px',
      fontSize: '12px'
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--sable-selection)'
    },
    '.cm-selectionBackground': {
      backgroundColor: 'var(--sable-selection)'
    }
  }),
  EditorView.contentAttributes.of({
    spellcheck: 'false',
    autocorrect: 'off',
    autocapitalize: 'off'
  }),
  syntaxHighlighting(sableSyntaxHighlightStyle)
]
