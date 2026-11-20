import { describe, expect, it } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { sableSchema } from '@renderer/editor/schema/sableSchema'
import { markdownToDoc } from '@renderer/editor/markdown/converter'
import { createInlineSyntaxRevealPlugin } from '@renderer/editor/plugins/inlineSyntaxReveal'
import { createImeGuardPlugin, imePluginKey } from '@renderer/editor/plugins/imeGuard'
import { getHeadingsFromState } from '@renderer/editor/plugins/commandsAndKeymap'
import { computeDocumentStats, useEditorStore } from '@renderer/stores/useEditorStore'
import { buildStandaloneExportHtml } from '@renderer/editor/exportHtmlBuilder'

describe('Inline Syntax Reveal & IME Guard', () => {
  it('reveals ** markers only when cursor sits inside strong text and suppresses during IME composition', () => {
    const doc = markdownToDoc('普通文字 **重点内容** 结尾')
    const imePlugin = createImeGuardPlugin()
    const revealPlugin = createInlineSyntaxRevealPlugin(() => true)

    const host = document.createElement('div')
    const view = new EditorView(host, {
      state: EditorState.create({
        doc,
        schema: sableSchema,
        plugins: [imePlugin, revealPlugin]
      })
    })

    // Cursor at pos 2 (inside "普通文字") -> no syntax markers
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)))
    expect(host.querySelectorAll('.sable-syntax-marker').length).toBe(0)

    // Cursor at pos 8 (inside "重点内容") -> opening and closing ** widgets
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 8)))
    const markers = Array.from(host.querySelectorAll('.sable-syntax-marker')).map(
      (el) => el.textContent
    )
    expect(markers).toEqual(['**', '**'])

    // Simulate active Chinese IME composition -> markers suppressed
    view.dispatch(view.state.tr.setMeta(imePluginKey, true))
    expect(host.querySelectorAll('.sable-syntax-marker').length).toBe(0)

    view.destroy()
  })
})

describe('Outline Extraction, Stats & Export Builder', () => {
  it('extracts heading hierarchy and computes CJK + Latin word stats accurately', () => {
    const md = '# 总标题\n\n这是中文测试 Hello world 123\n\n## 子章节'
    const doc = markdownToDoc(md)
    const state = EditorState.create({ doc, schema: sableSchema })
    const headings = getHeadingsFromState(state)

    expect(headings).toEqual([
      { level: 1, text: '总标题', pos: 0 },
      { level: 2, text: '子章节', pos: 29 }
    ])

    const stats = computeDocumentStats(md)
    // CJK chars: 总标题(3) + 这是中文测试(6) + 子章节(3) = 12; Latin words: Hello, world, 123 = 3 -> 15
    expect(stats.words).toBe(15)
    expect(stats.lines).toBe(5)
  })

  it('switches single-window vs multi-tab document opening cleanly in store', () => {
    const store = useEditorStore.getState()
    store.openLoadedDocument(
      { filePath: 'D:\\notes\\a.md', content: '# A', mtimeMs: 100 },
      false
    )
    expect(useEditorStore.getState().tabs.length).toBe(1)
    expect(useEditorStore.getState().getActiveTab().title).toBe('a.md')

    // In tabless mode, opening b.md replaces active window view
    store.openLoadedDocument(
      { filePath: 'D:\\notes\\b.md', content: '# B', mtimeMs: 200 },
      false
    )
    expect(useEditorStore.getState().tabs.length).toBe(1)
    expect(useEditorStore.getState().getActiveTab().title).toBe('b.md')

    // In multi-tab mode, opening c.md appends a second tab
    store.openLoadedDocument(
      { filePath: 'D:\\notes\\c.md', content: '# C', mtimeMs: 300 },
      true
    )
    expect(useEditorStore.getState().tabs.length).toBe(2)
    expect(useEditorStore.getState().getActiveTab().title).toBe('c.md')
  })

  it('builds standalone HTML export with rendered KaTeX and [TOC] links', async () => {
    const html = await buildStandaloneExportHtml({
      markdown: '[TOC]\n\n# 导言\n\n行内公式 $a^2 + b^2 = c^2$',
      title: '测试导出',
      docPath: null,
      themeCss: ':root { --sable-bg: #fff; }',
      katexCss: ''
    })
    expect(html).toContain('sable-toc-card')
    expect(html).toContain('href="#heading-0"')
    expect(html).toContain('katex')
  })
})
