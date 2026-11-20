import { describe, expect, it } from 'vitest'
import { docToMarkdown, markdownToDoc, parseImgHtmlTag } from '@renderer/editor/markdown/converter'
import { sableSchema } from '@renderer/editor/schema/sableSchema'

describe('Markdown <-> ProseMirror Converter', () => {
  it('preserves single line breaks within paragraphs and blank lines between paragraphs', () => {
    const input = '第一行文字\n第二行文字\n\n第二个独立段落'
    const doc = markdownToDoc(input)
    expect(doc.childCount).toBe(2)

    const firstPara = doc.child(0)
    expect(firstPara.type).toBe(sableSchema.nodes.paragraph)
    let hardBreakCount = 0
    firstPara.forEach((n) => {
      if (n.type === sableSchema.nodes.hard_break) hardBreakCount++
    })
    expect(hardBreakCount).toBe(1)

    const output = docToMarkdown(doc)
    expect(output).toBe(input)
  })

  it('round-trips YAML Front Matter and [TOC] without escaping or confusing with horizontal rules', () => {
    const input = [
      '---',
      'title: Sable 架构笔记',
      'tags: [markdown, desktop]',
      '---',
      '',
      '[TOC]',
      '',
      '# 第一章',
      '',
      '正文内容',
      '',
      '---',
      '',
      '## 第二节'
    ].join('\n')

    const doc = markdownToDoc(input)
    expect(doc.child(0).type).toBe(sableSchema.nodes.frontmatter)
    expect(doc.child(0).attrs.value).toContain('title: Sable 架构笔记')
    expect(doc.child(1).type).toBe(sableSchema.nodes.toc)
    expect(doc.child(4).type).toBe(sableSchema.nodes.horizontal_rule)

    const output = docToMarkdown(doc)
    expect(output).toBe(input)
  })

  it('round-trips inline formatting, links, and inline KaTeX formulas', () => {
    const input =
      '测试 **加粗** 与 *斜体*、~~删除线~~、`const x = 1`、[链接](https://example.com) 以及公式 $E = mc^2$。'
    const doc = markdownToDoc(input)
    const output = docToMarkdown(doc)
    expect(output).toBe(input)
  })

  it('round-trips GFM task lists, bullet lists, ordered lists, and blockquotes', () => {
    const input = [
      '- [x] 已完成任务',
      '- [ ] 待办任务',
      '',
      '1. 第一步',
      '2. 第二步',
      '',
      '> 这是一段引用文字'
    ].join('\n')

    const doc = markdownToDoc(input)
    const taskList = doc.child(0)
    expect(taskList.type).toBe(sableSchema.nodes.bullet_list)
    expect(taskList.child(0).attrs.checked).toBe(true)
    expect(taskList.child(1).attrs.checked).toBe(false)

    expect(docToMarkdown(doc)).toBe(input)
  })

  it('round-trips code blocks, math blocks, and Mermaid diagram blocks', () => {
    const input = [
      '```typescript',
      'const name: string = "Sable"',
      '```',
      '',
      '$$',
      '\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}',
      '$$',
      '',
      '```mermaid',
      'flowchart LR',
      '  A --> B',
      '```'
    ].join('\n')

    const doc = markdownToDoc(input)
    expect(doc.child(0).type).toBe(sableSchema.nodes.code_block)
    expect(doc.child(0).attrs.language).toBe('typescript')
    expect(doc.child(1).type).toBe(sableSchema.nodes.math_block)
    expect(doc.child(2).type).toBe(sableSchema.nodes.mermaid_block)

    expect(docToMarkdown(doc)).toBe(input)
  })

  it('round-trips GFM tables with column alignments', () => {
    const input = [
      '| 左对齐 | 居中 | 右对齐 |',
      '| :--- | :---: | ---: |',
      '| A1 | B1 | C1 |',
      '| A2 | B2 | C2 |'
    ].join('\n')

    const doc = markdownToDoc(input)
    const table = doc.child(0)
    expect(table.type).toBe(sableSchema.nodes.table)
    expect(table.child(0).child(0).attrs.align).toBe('left')
    expect(table.child(0).child(1).attrs.align).toBe('center')
    expect(table.child(0).child(2).attrs.align).toBe('right')

    expect(docToMarkdown(doc)).toBe(input)
  })

  it('parses and serializes standard images and zoomed/sized <img> HTML tags', () => {
    const parsedZoom = parseImgHtmlTag('<img src="./note.assets/shot.png" alt="截图" style="zoom: 50%;" />')
    expect(parsedZoom).toEqual({
      src: './note.assets/shot.png',
      alt: '截图',
      title: '',
      zoom: 50,
      width: null
    })

    const input = [
      '![原始图](./note.assets/raw.png)',
      '',
      '<img src="./note.assets/zoomed.png" alt="半尺寸图" style="zoom: 50%;" />',
      '',
      '<img src="./note.assets/fixed.png" alt="定宽图" width="360" />'
    ].join('\n')

    const doc = markdownToDoc(input)
    expect(doc.child(0).firstChild?.attrs.zoom).toBeNull()
    expect(doc.child(1).firstChild?.attrs.zoom).toBe(50)
    expect(doc.child(2).firstChild?.attrs.width).toBe(360)

    expect(docToMarkdown(doc)).toBe(input)
  })

  it('round-trips academic footnotes, superscripts, and subscripts without colliding with strikethrough', () => {
    const input = [
      '化学式 H~2~O 与复杂度 O(n^2^) 以及删除线 ~~废弃方案~~ 和文献脚注[^1]。',
      '',
      '[^1]: 这是第一条脚注的详细出处说明。'
    ].join('\n')

    const doc = markdownToDoc(input)
    expect(doc.child(1).type).toBe(sableSchema.nodes.footnote_def)
    expect(doc.child(1).attrs.id).toBe('1')

    expect(docToMarkdown(doc)).toBe(input)
  })
})
