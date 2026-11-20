# Sable

A crisp, local-first desktop Markdown editor built with `Electron`, `React`, `TypeScript`, `ProseMirror`, and `CodeMirror 6`.

## Features

- **Seamless Live Rendering**: Block-level Markdown syntax transforms immediately without layout jumpiness. Inline marks (`**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `[link](url)`) dynamically reveal syntax delimiters when the cursor enters them, with full Chinese `IME` composition protection.
- **Source Code Mode**: Switch instantaneously between live typography and `CodeMirror 6` Markdown source editing (`Ctrl + /`) with synchronized scroll position.
- **Rich Blocks**: Syntax-highlighted code blocks, live `KaTeX` math (`$...$` and `$$...$$`), `Mermaid` diagrams, `YAML Front Matter`, `[TOC]` auto-updating table of contents, task lists, and visual table row/column/alignment editing.
- **Local-First Workflow**: Real-time atomic auto-save, `chokidar` external file watching, `Outline` & `File Tree` sidebar with full-text search, optional top multi-tab bar, and automatic screenshot/image archiving to `./${filename}.assets/` with right-click zoom presets (`25%`, `50%`, `67%`, `100%`) and drag-to-resize.
- **Modern CSS Variable Themes & Export**: Includes `GitHub`, `Newsprint`, `Night`, and `Minimal` built-in themes plus custom `.css` theme loading, `Focus Mode` (`F8`), `Typewriter Mode` (`F9`), silent vector `PDF` export, and standalone single-file `HTML` export.

## Development

```bash
npm install
npm run dev
```

## Build & Package Standalone App

```bash
npm run typecheck
npm test
npm run pack
```

Running `npm run pack` produces a standalone executable at `release/Sable/Sable.exe` that can be pinned to the taskbar and set as your default `.md` editor in Windows Explorer.

## License

MIT
