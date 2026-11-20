# Sable

Sable is a local-first desktop Markdown editor built with Electron, React, ProseMirror, and CodeMirror 6.

I started this project to have a clean daily Markdown editor that behaves the way I actually write: block syntax (`#`, `>`, lists, tables, code fences) renders in place without shifting lines around when the cursor moves over them, inline marks (`**bold**`, `` `code` ``, `[link](url)`) reveal their raw delimiters only while the cursor is inside them, and switching to raw Markdown source (`Ctrl+/`) is instant.

## Download

Prebuilt archives are available on the [Releases](https://github.com/imxuhan/sable/releases) page.

On Windows, extract `Sable-*-win32-x64.zip` and run `Sable.exe`. You can associate `.md` files with `Sable.exe` in Explorer so double-clicking opens documents directly in an existing or new window.

## What It Supports

- **Hybrid live / source editing**: ProseMirror handles the rendered document view (with IME composition guards so CJK input does not drop characters); CodeMirror 6 handles `Source Code Mode` and embedded code blocks with syntax highlighting.
- **Markdown & extensions**: CommonMark + GFM tables, task lists (`- [x]`), strikethrough, `YAML` front matter, auto-updating `[TOC]`, inline and display math via KaTeX (`$...$`, `$$...$$`), and Mermaid diagrams.
- **Line-break preservation**: Pressing `Enter` starts a new paragraph (`\n\n`); `Shift+Enter` inserts a soft break. Single line breaks in existing `.md` files are preserved visually and round-trip without injecting trailing backslashes.
- **Local image workflow**: Pasting screenshots from the clipboard or dragging images into the editor copies them into `./<docname>.assets/` (configurable in Preferences) using relative paths. Right-click an image for zoom presets (`25%`, `50%`, `67%`, `100%`) or drag its corner handle to resize; custom sizes serialize as `<img>` tags.
- **Workspace & navigation**: Resizable `Outline` and `File Tree` sidebar with full-text search, atomic auto-save with `chokidar` external change detection, crash draft recovery, and an optional top multi-tab bar.
- **Themes & export**: Built on `--sable-*` CSS custom properties with four built-in themes (`GitHub`, `Newsprint`, `Night`, `Minimal`), plus hot-reloadable user `.css` files. Supports `Focus Mode` (`F8`), `Typewriter Mode` (`F9`), vector PDF export via Chromium `printToPDF`, and standalone single-file HTML export.

## Keyboard Shortcuts

| Action | Shortcut |
| :--- | :--- |
| New document / New window | `Ctrl + N` / `Ctrl + Shift + N` |
| Open file / Open folder | `Ctrl + O` / `Ctrl + Shift + O` |
| Save / Save as | `Ctrl + S` / `Ctrl + Shift + S` |
| Toggle Source Code Mode | `Ctrl + /` |
| Toggle Sidebar (`Outline` / `Files`) | `Ctrl + Shift + L` |
| Focus Mode / Typewriter Mode | `F8` / `F9` |
| Zoom interface in / out | `Ctrl + Mouse Wheel` |
| Headings 1–6 / Paragraph | `Ctrl + 1..6` / `Ctrl + 0` |
| Bold / Italic / Inline code / Link | `Ctrl + B` / `Ctrl + I` / `Ctrl + \`` / `Ctrl + K` |
| Insert table / Code block / Math block | `Ctrl + T` / `Ctrl + Shift + K` / `Ctrl + Shift + M` |
| Preferences | `Ctrl + ,` |

## Development

Requires Node.js 20+.

```bash
npm install

# Start in development mode with HMR
npm run dev

# Typecheck and run unit tests
npm run typecheck
npm test

# Build production bundles and package standalone app into release/Sable
npm run pack
```

## Custom Themes

Open `Themes -> Open Themes Folder` from the top menu bar (stored under `%APPDATA%/sable/themes` on Windows, `~/.config/sable/themes` on Linux, or `~/Library/Application Support/sable/themes` on macOS) and drop in any `.css` file overriding `--sable-*` variables. Click `Refresh Themes` in the menu to apply it without restarting.

## Project Layout

```text
src/
├── main/        # Electron main process: window lifecycle, file I/O, chokidar watcher, asset archiving, PDF/HTML export
├── preload/     # Context-isolated IPC bridge and sable-asset:// local image URL resolver
├── shared/      # Shared TypeScript interfaces and default preferences
└── renderer/
    ├── components/  # Custom title/menu bar, sidebar (outline & file tree), tab bar, status bar, modals
    ├── editor/      # ProseMirror schema, remark parser/serializer, input rules, node views, CodeMirror source editor
    ├── stores/      # Zustand state store
    └── themes/      # CSS variable definitions and base typography rules
```

## License

[MIT](./LICENSE)
