import type { CustomThemeDescriptor } from '@shared/types'

export const DEFAULT_MONO_STACK =
  '"SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "HarmonyOS Sans SC", "Sarasa Mono SC", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", monospace'

export const CODE_FONT_PRESETS: Record<string, string> = {
  default: DEFAULT_MONO_STACK,
  sarasa:
    '"Sarasa Mono SC", "SF Mono", Consolas, "HarmonyOS Sans SC", "Microsoft YaHei UI", monospace',
  cascadia:
    '"Cascadia Mono", "Cascadia Code", Consolas, "HarmonyOS Sans SC", "Sarasa Mono SC", "Microsoft YaHei UI", monospace',
  jetbrains:
    '"JetBrains Mono", "Fira Code", Consolas, "HarmonyOS Sans SC", "Sarasa Mono SC", "Microsoft YaHei UI", monospace'
}

export function resolveMonoFontStack(codeFontPref?: string): string {
  if (!codeFontPref || codeFontPref === 'default') {
    return DEFAULT_MONO_STACK
  }
  if (CODE_FONT_PRESETS[codeFontPref]) {
    return CODE_FONT_PRESETS[codeFontPref]
  }
  return `"${codeFontPref.replace(/"/g, '')}", ${DEFAULT_MONO_STACK}`
}

const LIGHT_SYNTAX_VARS = `
  --sable-syn-keyword: #cf222e;
  --sable-syn-string: #0a3069;
  --sable-syn-comment: #6e7781;
  --sable-syn-func: #8250df;
  --sable-syn-number: #0550ae;
  --sable-syn-type: #953800;
  --sable-syn-attr: #116329;
  --sable-syn-operator: #cf222e;
`

const DARK_SYNTAX_VARS = `
  --sable-syn-keyword: #c678dd;
  --sable-syn-string: #98c379;
  --sable-syn-comment: #7f848e;
  --sable-syn-func: #61afef;
  --sable-syn-number: #d19a66;
  --sable-syn-type: #e5c07b;
  --sable-syn-attr: #d19a66;
  --sable-syn-operator: #56b6c2;
`

export const THEME_VARIABLES: Record<string, string> = {
  github: `
    :root, .sable-editor-surface {
      --sable-bg: #ffffff;
      --sable-fg: #1f2328;
      --sable-muted: #656d76;
      --sable-accent: #0969da;
      --sable-border: #d0d7de;
      --sable-code-bg: #f6f8fa;
      --sable-code-fg: #1f2328;
      --sable-quote-border: #d0d7de;
      --sable-quote-fg: #59636e;
      --sable-table-stripe: #f6f8fa;
      --sable-selection: rgba(9, 105, 218, 0.16);
      --sable-font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      --sable-font-heading: -apple-system, BlinkMacSystemFont, "Segoe UI", "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei", sans-serif;
      --sable-line-height: 1.74;
      --sable-max-width: 840px;
      --sable-para-gap: 0.95em;
      ${LIGHT_SYNTAX_VARS}
    }
  `,
  newsprint: `
    :root, .sable-editor-surface {
      --sable-bg: #f8f5ec;
      --sable-fg: #2c2825;
      --sable-accent: #8b3a2b;
      --sable-muted: #766e65;
      --sable-border: #dcd5c7;
      --sable-code-bg: #efeadd;
      --sable-code-fg: #2c2825;
      --sable-quote-border: #b8ad99;
      --sable-quote-fg: #5d554c;
      --sable-table-stripe: #f2ede1;
      --sable-selection: rgba(139, 58, 43, 0.16);
      --sable-font-body: Georgia, "Times New Roman", "Source Han Serif SC", "Songti SC", "Noto Serif SC", "SimSun", serif;
      --sable-font-heading: Georgia, "Palatino Linotype", "Source Han Serif SC", "Songti SC", "Noto Serif SC", serif;
      --sable-line-height: 1.82;
      --sable-max-width: 780px;
      --sable-para-gap: 1.05em;
      ${LIGHT_SYNTAX_VARS}
    }
  `,
  night: `
    :root, .sable-editor-surface {
      --sable-bg: #181a1f;
      --sable-fg: #d7dae0;
      --sable-muted: #828997;
      --sable-accent: #61afef;
      --sable-border: #2c313a;
      --sable-code-bg: #21252b;
      --sable-code-fg: #dcdfe4;
      --sable-quote-border: #3e4451;
      --sable-quote-fg: #9da5b4;
      --sable-table-stripe: #1e2229;
      --sable-selection: rgba(97, 175, 239, 0.24);
      --sable-font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei", sans-serif;
      --sable-font-heading: -apple-system, BlinkMacSystemFont, "Segoe UI", "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei", sans-serif;
      --sable-line-height: 1.75;
      --sable-max-width: 840px;
      --sable-para-gap: 0.95em;
      ${DARK_SYNTAX_VARS}
    }
  `,
  minimal: `
    :root, .sable-editor-surface {
      --sable-bg: #fcfcfc;
      --sable-fg: #18181b;
      --sable-muted: #71717a;
      --sable-accent: #18181b;
      --sable-border: #e4e4e7;
      --sable-code-bg: #f4f4f5;
      --sable-code-fg: #18181b;
      --sable-quote-border: #a1a1aa;
      --sable-quote-fg: #52525b;
      --sable-table-stripe: #f8f8f9;
      --sable-selection: rgba(24, 24, 27, 0.12);
      --sable-font-body: "Inter", -apple-system, BlinkMacSystemFont, "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei", sans-serif;
      --sable-font-heading: "Inter", -apple-system, BlinkMacSystemFont, "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei", sans-serif;
      --sable-line-height: 1.78;
      --sable-max-width: 760px;
      --sable-para-gap: 1.05em;
      ${LIGHT_SYNTAX_VARS}
    }
  `
}

export const BASE_EDITOR_TYPOGRAPHY_CSS = `
.sable-editor-surface {
  background: var(--sable-bg);
  color: var(--sable-fg);
  font-family: var(--sable-font-body);
  font-size: var(--sable-font-size, 16px);
  line-height: var(--sable-line-height);
  width: var(--sable-content-width, 90%);
  max-width: none;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 36px 28px 160px;
  word-wrap: break-word;
  -webkit-font-smoothing: antialiased;
}

.sable-editor-surface ::selection {
  background: var(--sable-selection);
}

.sable-editor-surface .ProseMirror {
  outline: none;
  min-height: calc(100vh - 180px);
}

.sable-editor-surface h1,
.sable-editor-surface h2,
.sable-editor-surface h3,
.sable-editor-surface h4,
.sable-editor-surface h5,
.sable-editor-surface h6 {
  font-family: var(--sable-font-heading);
  font-weight: 650;
  line-height: 1.32;
  margin-top: 1.45em;
  margin-bottom: 0.6em;
  color: var(--sable-fg);
}

.sable-editor-surface h1 {
  font-size: 1.95em;
}

.sable-editor-surface h2 {
  font-size: 1.5em;
}

.sable-editor-surface h3 { font-size: 1.26em; }
.sable-editor-surface h4 { font-size: 1.08em; }
.sable-editor-surface h5 { font-size: 0.96em; color: var(--sable-muted); }
.sable-editor-surface h6 { font-size: 0.9em; color: var(--sable-muted); }

.sable-editor-surface p {
  margin: 0 0 var(--sable-para-gap) 0;
}

.sable-editor-surface a {
  color: var(--sable-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.sable-editor-surface strong {
  font-weight: 650;
}

.sable-editor-surface del {
  color: var(--sable-muted);
}

.sable-editor-surface :not(pre) > code {
  font-family: var(--sable-font-mono);
  font-size: 0.875em;
  background: var(--sable-code-bg);
  color: var(--sable-code-fg);
  padding: 0.16em 0.42em;
  border-radius: 5px;
}

.sable-editor-surface blockquote {
  margin: 1em 0;
  padding: 0.25em 1em;
  border-left: 4px solid var(--sable-quote-border);
  color: var(--sable-quote-fg);
}

.sable-editor-surface blockquote > p:last-child {
  margin-bottom: 0;
}

.sable-editor-surface ul,
.sable-editor-surface ol {
  margin: 0.4em 0 var(--sable-para-gap) 0;
  padding-left: 1.7em;
}

.sable-editor-surface ul {
  list-style-type: disc;
}

.sable-editor-surface ol {
  list-style-type: decimal;
}

.sable-editor-surface li > p {
  margin-bottom: 0.28em;
}

.sable-editor-surface li.sable-task-item {
  list-style: none;
  position: relative;
}

.sable-editor-surface li.sable-task-item::before {
  content: "";
  position: absolute;
  left: -1.42em;
  top: 0.36em;
  width: 0.95em;
  height: 0.95em;
  border: 1.5px solid var(--sable-muted);
  border-radius: 3px;
  cursor: pointer;
  background: transparent;
}

.sable-editor-surface li.sable-task-item.is-checked::before {
  background: var(--sable-accent);
  border-color: var(--sable-accent);
  background-image: linear-gradient(45deg, transparent 35%, #fff 35%, #fff 50%, transparent 50%);
}

.sable-editor-surface li.sable-task-item.is-checked > p:first-child {
  color: var(--sable-muted);
  text-decoration: line-through;
}

.sable-editor-surface hr {
  border: none;
  border-top: 1.5px solid var(--sable-border);
  margin: 1.8em 0;
}

.sable-editor-surface table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.2em 0;
  table-layout: fixed;
}

.sable-editor-surface th,
.sable-editor-surface td {
  border: 1px solid var(--sable-border);
  padding: 8px 12px;
  vertical-align: top;
}

.sable-editor-surface th {
  background: var(--sable-code-bg);
  font-weight: 600;
}

.sable-editor-surface tr:nth-child(even) td {
  background: var(--sable-table-stripe);
}

.sable-editor-surface th > p,
.sable-editor-surface td > p {
  margin: 0;
}

.sable-editor-surface pre.sable-code-pre {
  background: var(--sable-code-bg);
  color: var(--sable-code-fg);
  font-family: var(--sable-font-mono);
  font-size: 0.875em;
  line-height: 1.65;
  padding: 14px 16px;
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid var(--sable-border);
}

.sable-editor-surface img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}
`

export function isThemeDark(themeId: string, customThemes: CustomThemeDescriptor[]): boolean {
  if (themeId === 'night') return true
  const custom = customThemes.find((t) => t.id === themeId)
  if (custom) {
    return /--sable-bg\s*:\s*#[0-2]/i.test(custom.cssContent)
  }
  return false
}

export function buildCombinedThemeCss(
  themeId: string,
  customThemes: CustomThemeDescriptor[],
  fontSize: number,
  codeFontFamily?: string,
  contentWidthPercent = 90,
  showHeadingDivider = false
): string {
  const builtinVars = THEME_VARIABLES[themeId] || THEME_VARIABLES.github
  const custom = customThemes.find((t) => t.id === themeId)
  const monoStack = resolveMonoFontStack(codeFontFamily)
  const uiFontSize = Math.max(13.5, Math.round(fontSize * 0.9 * 10) / 10)
  const clampedWidth = Math.min(100, Math.max(55, contentWidthPercent || 90))
  const dynamicVars = `:root, .sable-editor-surface { --sable-font-size: ${fontSize}px; --sable-ui-font-size: ${uiFontSize}px; --sable-content-width: ${clampedWidth}%; --sable-font-mono: ${monoStack}; }`
  const dividerCss = showHeadingDivider
    ? `.sable-editor-surface h1 { padding-bottom: 0.28em; border-bottom: 1px solid var(--sable-border); } .sable-editor-surface h2 { padding-bottom: 0.22em; border-bottom: 1px solid var(--sable-border); }`
    : ''
  return [
    builtinVars,
    dynamicVars,
    BASE_EDITOR_TYPOGRAPHY_CSS,
    dividerCss,
    custom ? custom.cssContent : ''
  ].join('\n')
}
