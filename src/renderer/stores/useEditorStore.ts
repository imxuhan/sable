import { create } from 'zustand'
import { DEFAULT_PREFERENCES } from '@shared/defaults'
import type {
  CustomThemeDescriptor,
  FileTreeNode,
  SablePreferences,
  WorkspaceSearchResult
} from '@shared/types'

export interface EditorTab {
  id: string
  filePath: string | null
  title: string
  content: string
  savedContent: string
  isDirty: boolean
  mtimeMs: number | null
  scrollRatio: number
}

export interface DocumentStats {
  words: number
  chars: number
  lines: number
  readingMinutes: number
}

export function computeDocumentStats(markdown: string): DocumentStats {
  const clean = markdown || ''
  if (!clean.trim()) {
    return { words: 0, chars: 0, lines: 1, readingMinutes: 0 }
  }
  const cjkMatches = clean.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g)
  const cjkCount = cjkMatches ? cjkMatches.length : 0
  const nonCjk = clean.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
  const latinWords = nonCjk
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-zA-Z0-9]/.test(w)).length

  const words = cjkCount + latinWords
  const chars = clean.replace(/\s/g, '').length
  const lines = clean.split('\n').length
  const readingMinutes = Math.max(1, Math.ceil(words / 300))

  return { words, chars, lines, readingMinutes }
}

function makeUntitledTab(content = ''): EditorTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    filePath: null,
    title: 'Untitled',
    content,
    savedContent: content,
    isDirty: false,
    mtimeMs: null,
    scrollRatio: 0
  }
}

function fileNameFromPath(filePath: string): string {
  const parts = filePath.split(/[\\/]/)
  return parts[parts.length - 1] || 'Untitled.md'
}

interface EditorStoreState {
  initialized: boolean
  tabs: EditorTab[]
  activeTabId: string
  preferences: SablePreferences
  customThemes: CustomThemeDescriptor[]
  recentFiles: string[]
  workspaceDir: string | null
  workspaceTree: FileTreeNode[]
  workspaceQuery: string
  workspaceResults: WorkspaceSearchResult[]
  headings: Array<{ level: number; text: string; pos: number }>
  stats: DocumentStats

  showPreferencesModal: boolean
  showShortcutsModal: boolean
  showAboutModal: boolean
  showFindBar: boolean
  statusToast: string | null

  hydrateInitial: (payload: {
    preferences: SablePreferences
    recentFiles: string[]
    recentWorkspace: string | null
    customThemes: CustomThemeDescriptor[]
    initialTab?: EditorTab
  }) => void

  getActiveTab: () => EditorTab
  setActiveTab: (id: string) => void
  createNewTab: (reuseCurrentIfSingleWindow?: boolean, initialContent?: string) => void
  openLoadedDocument: (
    doc: { filePath: string; content: string; mtimeMs: number },
    openInTabMode: boolean
  ) => void
  closeTab: (id: string) => void
  updateActiveContent: (content: string, scrollRatio?: number) => void
  markTabSaved: (id: string, filePath: string, content: string, mtimeMs: number) => void
  applyExternalUpdate: (filePath: string, content: string, mtimeMs: number) => void

  setHeadings: (headings: Array<{ level: number; text: string; pos: number }>) => void
  updatePreferences: (patch: Partial<SablePreferences>) => void
  setCustomThemes: (themes: CustomThemeDescriptor[]) => void
  setRecentFiles: (files: string[]) => void

  setWorkspace: (dir: string | null, tree: FileTreeNode[]) => void
  setWorkspaceSearch: (query: string, results: WorkspaceSearchResult[]) => void

  setShowPreferencesModal: (v: boolean) => void
  setShowShortcutsModal: (v: boolean) => void
  setShowAboutModal: (v: boolean) => void
  setShowFindBar: (v: boolean) => void
  flashToast: (msg: string) => void
}

const initialTab = makeUntitledTab('')

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  initialized: false,
  tabs: [initialTab],
  activeTabId: initialTab.id,
  preferences: { ...DEFAULT_PREFERENCES },
  customThemes: [],
  recentFiles: [],
  workspaceDir: null,
  workspaceTree: [],
  workspaceQuery: '',
  workspaceResults: [],
  headings: [],
  stats: { words: 0, chars: 0, lines: 1, readingMinutes: 0 },

  showPreferencesModal: false,
  showShortcutsModal: false,
  showAboutModal: false,
  showFindBar: false,
  statusToast: null,

  hydrateInitial: ({ preferences, recentFiles, recentWorkspace, customThemes, initialTab: tab }) => {
    const chosenTab = tab || makeUntitledTab('')
    set({
      initialized: true,
      preferences,
      recentFiles,
      workspaceDir: recentWorkspace,
      customThemes,
      tabs: [chosenTab],
      activeTabId: chosenTab.id,
      stats: computeDocumentStats(chosenTab.content)
    })
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find((t) => t.id === activeTabId) || tabs[0]
  },

  setActiveTab: (id) => {
    const found = get().tabs.find((t) => t.id === id)
    if (!found) return
    set({
      activeTabId: id,
      stats: computeDocumentStats(found.content)
    })
  },

  createNewTab: (reuseCurrentIfSingleWindow = false, initialContent = '') => {
    const fresh = makeUntitledTab(initialContent)
    if (initialContent) {
      fresh.isDirty = true
    }
    const { tabs, preferences } = get()
    if (reuseCurrentIfSingleWindow && !preferences.showTabBar) {
      set({
        tabs: [fresh],
        activeTabId: fresh.id,
        headings: [],
        stats: computeDocumentStats(fresh.content)
      })
      return
    }
    set({
      tabs: [...tabs, fresh],
      activeTabId: fresh.id,
      headings: [],
      stats: computeDocumentStats(fresh.content)
    })
  },

  openLoadedDocument: (doc, openInTabMode) => {
    const { tabs, activeTabId } = get()
    const existing = tabs.find(
      (t) => t.filePath && t.filePath.toLowerCase() === doc.filePath.toLowerCase()
    )
    if (existing) {
      set({
        activeTabId: existing.id,
        stats: computeDocumentStats(existing.content)
      })
      return
    }

    const loadedTab: EditorTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      filePath: doc.filePath,
      title: fileNameFromPath(doc.filePath),
      content: doc.content,
      savedContent: doc.content,
      isDirty: false,
      mtimeMs: doc.mtimeMs,
      scrollRatio: 0
    }

    if (!openInTabMode) {
      set({
        tabs: [loadedTab],
        activeTabId: loadedTab.id,
        stats: computeDocumentStats(loadedTab.content)
      })
      return
    }

    const active = tabs.find((t) => t.id === activeTabId)
    if (active && !active.filePath && !active.content.trim() && !active.isDirty) {
      set({
        tabs: tabs.map((t) => (t.id === active.id ? loadedTab : t)),
        activeTabId: loadedTab.id,
        stats: computeDocumentStats(loadedTab.content)
      })
    } else {
      set({
        tabs: [...tabs, loadedTab],
        activeTabId: loadedTab.id,
        stats: computeDocumentStats(loadedTab.content)
      })
    }
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get()
    if (tabs.length <= 1) {
      const reset = makeUntitledTab('')
      set({
        tabs: [reset],
        activeTabId: reset.id,
        headings: [],
        stats: { words: 0, chars: 0, lines: 1, readingMinutes: 0 }
      })
      return
    }
    const idx = tabs.findIndex((t) => t.id === id)
    const nextTabs = tabs.filter((t) => t.id !== id)
    const nextActive =
      id === activeTabId ? nextTabs[Math.max(0, idx - 1)] || nextTabs[0] : tabs.find((t) => t.id === activeTabId)!
    set({
      tabs: nextTabs,
      activeTabId: nextActive.id,
      stats: computeDocumentStats(nextActive.content)
    })
  },

  updateActiveContent: (content, scrollRatio) => {
    const { tabs, activeTabId } = get()
    const nextTabs = tabs.map((t) => {
      if (t.id !== activeTabId) return t
      return {
        ...t,
        content,
        isDirty: content !== t.savedContent,
        scrollRatio: scrollRatio !== undefined ? scrollRatio : t.scrollRatio
      }
    })
    set({
      tabs: nextTabs,
      stats: computeDocumentStats(content)
    })
  },

  markTabSaved: (id, filePath, content, mtimeMs) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id
          ? {
              ...t,
              filePath,
              title: fileNameFromPath(filePath),
              content,
              savedContent: content,
              isDirty: false,
              mtimeMs
            }
          : t
      )
    }))
  },

  applyExternalUpdate: (filePath, content, mtimeMs) => {
    const { tabs, activeTabId } = get()
    const target = tabs.find(
      (t) => t.filePath && t.filePath.toLowerCase() === filePath.toLowerCase()
    )
    if (!target) return
    if (target.isDirty && target.content !== content) {
      get().flashToast('检测到磁盘文件被外部修改，当前有未保存内容，已暂缓覆盖')
      return
    }
    const nextTabs = tabs.map((t) =>
      t.id === target.id
        ? {
            ...t,
            content,
            savedContent: content,
            isDirty: false,
            mtimeMs
          }
        : t
    )
    set({
      tabs: nextTabs,
      ...(target.id === activeTabId ? { stats: computeDocumentStats(content) } : {})
    })
  },

  setHeadings: (headings) => set({ headings }),

  updatePreferences: (patch) => {
    const next = { ...get().preferences, ...patch }
    set({ preferences: next })
    if (typeof window !== 'undefined' && window.sable) {
      void window.sable.savePreferences(next)
    }
  },

  setCustomThemes: (customThemes) => set({ customThemes }),
  setRecentFiles: (recentFiles) => set({ recentFiles }),

  setWorkspace: (workspaceDir, workspaceTree) => set({ workspaceDir, workspaceTree }),
  setWorkspaceSearch: (workspaceQuery, workspaceResults) =>
    set({ workspaceQuery, workspaceResults }),

  setShowPreferencesModal: (showPreferencesModal) => set({ showPreferencesModal }),
  setShowShortcutsModal: (showShortcutsModal) => set({ showShortcutsModal }),
  setShowAboutModal: (showAboutModal) => set({ showAboutModal }),
  setShowFindBar: (showFindBar) => set({ showFindBar }),

  flashToast: (msg) => {
    set({ statusToast: msg })
    setTimeout(() => {
      if (get().statusToast === msg) {
        set({ statusToast: null })
      }
    }, 2400)
  }
}))
