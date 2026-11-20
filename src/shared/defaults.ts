import type { SablePreferences } from './types'

export const DEFAULT_PREFERENCES: SablePreferences = {
  autoSave: true,
  autoSaveDelayMs: 1000,
  showTabBar: false,
  showSidebar: false,
  sidebarTab: 'outline',
  sidebarWidth: 260,
  theme: 'github',
  inlineSyntaxReveal: true,
  showFloatingToolbar: false,
  enableSlashMenu: false,
  focusMode: false,
  typewriterMode: false,
  sourceCodeMode: false,
  imageAction: 'copy-doc-assets',
  customImageDir: './assets',
  pdfPageSize: 'A4',
  pdfMargins: 'default',
  htmlEmbedImages: true,
  fontSize: 16
}

export const BUILTIN_THEMES = [
  { id: 'github', name: 'GitHub', isDark: false },
  { id: 'newsprint', name: 'Newsprint', isDark: false },
  { id: 'night', name: 'Night', isDark: true },
  { id: 'minimal', name: 'Minimal', isDark: false }
] as const
