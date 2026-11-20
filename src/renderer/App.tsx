import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import katexCssRaw from 'katex/dist/katex.min.css?inline'
import type { MenuCommand } from '@shared/types'
import { useEditorStore } from './stores/useEditorStore'
import { LiveEditor, type LiveEditorHandle } from './editor/LiveEditor'
import { SourceEditor } from './editor/source/SourceEditor'
import { buildStandaloneExportHtml } from './editor/exportHtmlBuilder'
import { Sidebar } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { StatusBar } from './components/StatusBar'
import { TitleMenuBar } from './components/TitleMenuBar'
import { AboutModal, PreferencesModal, ShortcutsModal } from './components/Modals'
import { buildCombinedThemeCss, isThemeDark } from './themes/themes'

const MARKDOWN_GUIDE_SAMPLE = `---
title: Sable 快速上手与语法示例
author: Sable
---

# 欢迎使用 Sable

[TOC]

## 1. 即时渲染与行内语法

将光标移入 **加粗文字**、*斜体文字*、~~删除线~~、\`行内代码\` 或 [超链接示例](https://example.com) 内部时，会自动展开原始 Markdown 标记方便直接编辑。

支持保留单换行折行：
第一行内容（直接单换行）
第二行内容（不会被强行合并成一行）

行内数学公式示例：$E = mc^2$ 以及欧拉恒等式 $e^{i\\pi} + 1 = 0$。

## 2. 任务列表与引用

- [x] 即时渲染块级与行内语法
- [x] 实时自动保存与本地图片归档
- [ ] 点击左侧复选框切换完成状态

> 专注写作本身，把繁琐的排版交给工具。

## 3. 可视化表格

| 模块 | 底层方案 | 关键特性 |
| :--- | :---: | ---: |
| 主编辑视图 | ProseMirror | 排版稳定不跳动 |
| 源码与代码块 | CodeMirror 6 | 多语言语法高亮 |
| 导出引擎 | Chromium | 静默矢量 PDF |

## 4. 代码块与公式块

\`\`\`typescript
function greet(editor: string): string {
  return \`Hello from \${editor}!\`
}
\`\`\`

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

## 5. Mermaid 流程图

\`\`\`mermaid
flowchart LR
  Input["Markdown 输入"] --> AST["Remark 解析"]
  AST --> Live["即时排版视图"]
  Live --> PDF["导出 PDF / HTML"]
\`\`\`
`

export const App: React.FC = () => {
  const {
    initialized,
    tabs,
    activeTabId,
    preferences,
    customThemes,
    recentFiles,
    workspaceDir,
    showFindBar,
    hydrateInitial,
    getActiveTab,
    createNewTab,
    openLoadedDocument,
    closeTab,
    updateActiveContent,
    markTabSaved,
    applyExternalUpdate,
    setHeadings,
    updatePreferences,
    setCustomThemes,
    setRecentFiles,
    setWorkspace,
    setShowPreferencesModal,
    setShowShortcutsModal,
    setShowAboutModal,
    setShowFindBar,
    flashToast
  } = useEditorStore()

  const liveEditorRef = useRef<LiveEditorHandle | null>(null)
  const [sourceFindTrigger, setSourceFindTrigger] = useState(0)

  const activeTab = getActiveTab()
  const darkTheme = useMemo(
    () => isThemeDark(preferences.theme, customThemes),
    [preferences.theme, customThemes]
  )

  const combinedThemeCss = useMemo(
    () =>
      buildCombinedThemeCss(
        preferences.theme,
        customThemes,
        preferences.fontSize,
        preferences.codeFontFamily,
        preferences.contentWidthPercent
      ),
    [
      preferences.theme,
      customThemes,
      preferences.fontSize,
      preferences.codeFontFamily,
      preferences.contentWidthPercent
    ]
  )

  useEffect(() => {
    let styleEl = document.getElementById('sable-dynamic-theme') as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'sable-dynamic-theme'
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = combinedThemeCss
    document.documentElement.classList.toggle('dark', darkTheme)
  }, [combinedThemeCss, darkTheme])

  const refreshWorkspaceTree = useCallback(async (dir: string | null) => {
    if (!dir || !window.sable) {
      setWorkspace(null, [])
      return
    }
    const tree = await window.sable.readWorkspaceTree(dir)
    setWorkspace(dir, tree)
    await window.sable.watchWorkspace(dir)
  }, [])

  useEffect(() => {
    if (!window.sable) {
      hydrateInitial({
        preferences,
        recentFiles: [],
        recentWorkspace: null,
        customThemes: []
      })
      return
    }

    void (async () => {
      const [persisted, loadedThemes, launchFile] = await Promise.all([
        window.sable.loadAppState(),
        window.sable.listCustomThemes(),
        window.sable.consumeLaunchFile()
      ])

      let launchTab:
        | {
            id: string
            filePath: string | null
            title: string
            content: string
            savedContent: string
            isDirty: boolean
            mtimeMs: number | null
            scrollRatio: number
          }
        | undefined

      let recentList = persisted.recentFiles

      if (launchFile) {
        try {
          const doc = await window.sable.readFile(launchFile)
          const name = doc.filePath.split(/[\\/]/).pop() || 'Untitled.md'
          launchTab = {
            id: `tab-${Date.now()}`,
            filePath: doc.filePath,
            title: name,
            content: doc.content,
            savedContent: doc.content,
            isDirty: false,
            mtimeMs: doc.mtimeMs,
            scrollRatio: 0
          }
          recentList = await window.sable.addRecentFile(doc.filePath)
        } catch {
          // Fall back to draft or empty tab if CLI file doesn't exist
        }
      }

      const recoveredDraft = persisted.drafts[0]
      hydrateInitial({
        preferences: persisted.preferences,
        recentFiles: recentList,
        recentWorkspace: persisted.recentWorkspace,
        customThemes: loadedThemes,
        initialTab:
          launchTab ??
          (recoveredDraft
            ? {
                id: recoveredDraft.id,
                filePath: null,
                title: recoveredDraft.title || 'Untitled',
                content: recoveredDraft.content,
                savedContent: '',
                isDirty: Boolean(recoveredDraft.content),
                mtimeMs: null,
                scrollRatio: 0
              }
            : undefined)
      })
      if (persisted.recentWorkspace) {
        await refreshWorkspaceTree(persisted.recentWorkspace)
      }
    })()
  }, [])

  useEffect(() => {
    if (!initialized || !window.sable) return
    const dirtyPrefix = activeTab.isDirty ? '● ' : ''
    window.sable.setWindowTitle(`${dirtyPrefix}${activeTab.title} — Sable`)
    void window.sable.watchDocument(activeTab.filePath)
  }, [initialized, activeTab.id, activeTab.filePath, activeTab.title, activeTab.isDirty])

  useEffect(() => {
    if (!initialized || !window.sable) return
    window.sable.syncMenuState({
      showSidebar: preferences.showSidebar,
      sidebarTab: preferences.sidebarTab,
      showTabBar: preferences.showTabBar,
      sourceCodeMode: preferences.sourceCodeMode,
      focusMode: preferences.focusMode,
      typewriterMode: preferences.typewriterMode,
      theme: preferences.theme,
      customThemes: customThemes.map((t) => ({ id: t.id, name: t.name })),
      recentFiles
    })
  }, [
    initialized,
    preferences.showSidebar,
    preferences.sidebarTab,
    preferences.showTabBar,
    preferences.sourceCodeMode,
    preferences.focusMode,
    preferences.typewriterMode,
    preferences.theme,
    customThemes,
    recentFiles
  ])

  const saveTabNow = useCallback(
    async (forceSaveAs = false): Promise<boolean> => {
      if (!window.sable) return false
      const tab = useEditorStore.getState().getActiveTab()

      if (!tab.filePath || forceSaveAs) {
        const saved = await window.sable.saveFileAs(tab.content, tab.filePath)
        if (!saved) return false
        markTabSaved(tab.id, saved.filePath, saved.content, saved.mtimeMs)
        const updatedRecent = await window.sable.addRecentFile(saved.filePath)
        setRecentFiles(updatedRecent)
        if (workspaceDir) {
          void refreshWorkspaceTree(workspaceDir)
        }
        flashToast('已保存文档')
        return true
      }

      const { mtimeMs } = await window.sable.writeFile(tab.filePath, tab.content)
      markTabSaved(tab.id, tab.filePath, tab.content, mtimeMs)
      return true
    },
    [workspaceDir, refreshWorkspaceTree]
  )

  useEffect(() => {
    if (!initialized || !window.sable) return

    const unsavedDrafts = tabs
      .filter((t) => !t.filePath && t.content.trim().length > 0)
      .map((t) => ({
        id: t.id,
        title: t.title,
        content: t.content,
        updatedAt: Date.now()
      }))
    const draftTimer = setTimeout(() => {
      void window.sable.saveDrafts(unsavedDrafts)
    }, 600)

    if (!preferences.autoSave || !activeTab.filePath || !activeTab.isDirty) {
      return () => clearTimeout(draftTimer)
    }

    const saveTimer = setTimeout(() => {
      void window.sable.writeFile(activeTab.filePath!, activeTab.content).then(({ mtimeMs }) => {
        markTabSaved(activeTab.id, activeTab.filePath!, activeTab.content, mtimeMs)
      })
    }, preferences.autoSaveDelayMs || 1000)

    return () => {
      clearTimeout(draftTimer)
      clearTimeout(saveTimer)
    }
  }, [
    initialized,
    tabs,
    activeTab.id,
    activeTab.filePath,
    activeTab.content,
    activeTab.isDirty,
    preferences.autoSave,
    preferences.autoSaveDelayMs
  ])

  useEffect(() => {
    const handleWindowBlur = (): void => {
      const state = useEditorStore.getState()
      const cur = state.getActiveTab()
      if (state.preferences.autoSave && cur.filePath && cur.isDirty && window.sable) {
        void window.sable.writeFile(cur.filePath, cur.content).then(({ mtimeMs }) => {
          state.markTabSaved(cur.id, cur.filePath!, cur.content, mtimeMs)
        })
      }
    }
    window.addEventListener('blur', handleWindowBlur)
    return () => window.removeEventListener('blur', handleWindowBlur)
  }, [])

  const openFileByPath = useCallback(async (filePath: string) => {
    if (!window.sable) return
    try {
      const doc = await window.sable.readFile(filePath)
      const inTabMode = useEditorStore.getState().preferences.showTabBar
      openLoadedDocument(doc, inTabMode)
      const updatedRecent = await window.sable.addRecentFile(doc.filePath)
      setRecentFiles(updatedRecent)
    } catch {
      flashToast('无法读取目标文件')
    }
  }, [])

  const handleOpenFolder = useCallback(async () => {
    if (!window.sable) return
    const chosen = await window.sable.openFolderDialog()
    if (!chosen) return
    await window.sable.saveRecentWorkspace(chosen)
    updatePreferences({ showSidebar: true, sidebarTab: 'files' })
    await refreshWorkspaceTree(chosen)
  }, [refreshWorkspaceTree])

  const handleExport = useCallback(
    async (kind: 'pdf' | 'html') => {
      if (!window.sable) return
      const state = useEditorStore.getState()
      const curTab = state.getActiveTab()
      flashToast(kind === 'pdf' ? '正在准备 PDF 渲染...' : '正在生成 HTML...')

      const htmlDoc = await buildStandaloneExportHtml({
        markdown: curTab.content,
        title: curTab.title.replace(/\.(md|markdown)$/i, ''),
        docPath: curTab.filePath,
        themeCss: combinedThemeCss,
        katexCss: katexCssRaw
      })

      if (kind === 'pdf') {
        const out = await window.sable.exportPdf({
          htmlDocument: htmlDoc,
          defaultPath: curTab.filePath || `${curTab.title}.pdf`,
          pageSize: state.preferences.pdfPageSize,
          margins: state.preferences.pdfMargins
        })
        if (out) flashToast('已成功导出 PDF')
      } else {
        const out = await window.sable.exportHtml({
          htmlDocument: htmlDoc,
          defaultPath: curTab.filePath || `${curTab.title}.html`,
          docPath: curTab.filePath,
          embedImages: state.preferences.htmlEmbedImages
        })
        if (out) flashToast('已成功导出 HTML')
      }
    },
    [combinedThemeCss]
  )

  const handleCloseTabRequest = useCallback(
    async (tabId: string) => {
      const target = useEditorStore.getState().tabs.find((t) => t.id === tabId)
      if (!target) return
      if (target.isDirty && !target.filePath && target.content.trim().length > 0) {
        const shouldSave = window.confirm(`文档 "${target.title}" 尚未保存，是否先保存到本地？`)
        if (shouldSave) {
          useEditorStore.getState().setActiveTab(tabId)
          const saved = await saveTabNow(true)
          if (!saved) return
        }
      }
      closeTab(tabId)
    },
    [saveTabNow]
  )

  const executeMenuCommand = useCallback(
    (cmd: MenuCommand, payload?: string) => {
      const state = useEditorStore.getState()
      const prefs = state.preferences

      switch (cmd) {
        case 'file:new':
          state.createNewTab(true)
          break
        case 'file:new-window':
          if (window.sable) void window.sable.createNewWindow()
          break
        case 'file:open':
          if (window.sable) {
            void window.sable.openFileDialog().then(async (doc) => {
              if (!doc) return
              state.openLoadedDocument(doc, state.preferences.showTabBar)
              const rec = await window.sable.addRecentFile(doc.filePath)
              state.setRecentFiles(rec)
            })
          }
          break
        case 'file:open-folder':
          void handleOpenFolder()
          break
        case 'file:open-recent':
          if (payload) void openFileByPath(payload)
          break
        case 'file:clear-recent':
          if (window.sable) {
            void window.sable.clearRecentFiles().then(() => state.setRecentFiles([]))
          }
          break
        case 'file:save':
          void saveTabNow(false)
          break
        case 'file:save-as':
          void saveTabNow(true)
          break
        case 'file:export-pdf':
          void handleExport('pdf')
          break
        case 'file:export-html':
          void handleExport('html')
          break
        case 'file:preferences':
          state.setShowPreferencesModal(true)
          break

        case 'edit:copy-markdown': {
          const md = prefs.sourceCodeMode
            ? state.getActiveTab().content
            : liveEditorRef.current?.getSelectedMarkdownOrAll() || state.getActiveTab().content
          void navigator.clipboard.writeText(md)
          state.flashToast('已复制 Markdown')
          break
        }
        case 'edit:copy-html': {
          const html = liveEditorRef.current?.getSelectedHtmlOrAll() || ''
          void navigator.clipboard.writeText(html)
          state.flashToast('已复制 HTML')
          break
        }
        case 'edit:find':
          if (prefs.sourceCodeMode) {
            setSourceFindTrigger((n) => n + 1)
          } else {
            state.setShowFindBar(!state.showFindBar)
          }
          break

        case 'view:toggle-sidebar':
          state.updatePreferences({ showSidebar: !prefs.showSidebar })
          break
        case 'view:outline':
          state.updatePreferences({ showSidebar: true, sidebarTab: 'outline' })
          break
        case 'view:files':
          state.updatePreferences({ showSidebar: true, sidebarTab: 'files' })
          break
        case 'view:toggle-tabs':
          state.updatePreferences({ showTabBar: !prefs.showTabBar })
          break
        case 'view:toggle-source':
          state.updatePreferences({ sourceCodeMode: !prefs.sourceCodeMode })
          break
        case 'view:toggle-focus':
          state.updatePreferences({ focusMode: !prefs.focusMode })
          break
        case 'view:toggle-typewriter':
          state.updatePreferences({ typewriterMode: !prefs.typewriterMode })
          break

        case 'theme:select':
          if (payload) state.updatePreferences({ theme: payload })
          break
        case 'theme:refresh':
          if (window.sable) {
            void window.sable.listCustomThemes().then((list) => {
              state.setCustomThemes(list)
              state.flashToast('已刷新主题列表')
            })
          }
          break
        case 'theme:open-folder':
          if (window.sable) void window.sable.openThemesFolder()
          break

        case 'help:shortcuts':
          state.setShowShortcutsModal(true)
          break
        case 'help:markdown-guide':
          state.createNewTab(!prefs.showTabBar, MARKDOWN_GUIDE_SAMPLE)
          break
        case 'help:about':
          state.setShowAboutModal(true)
          break

        default:
          if (!prefs.sourceCodeMode) {
            liveEditorRef.current?.executeCommand(cmd)
          }
          break
      }
    },
    [handleOpenFolder, handleExport, openFileByPath, saveTabNow]
  )

  useEffect(() => {
    if (!window.sable) return

    const unsubMenu = window.sable.onMenuCommand((cmd: MenuCommand, payload?: string) => {
      executeMenuCommand(cmd, payload)
    })

    const unsubOpenReq = window.sable.onOpenFileRequest((filePath) => {
      void openFileByPath(filePath)
    })

    const unsubExtChange = window.sable.onExternalFileChanged(({ filePath, content, mtimeMs }) => {
      applyExternalUpdate(filePath, content, mtimeMs)
    })

    const unsubTreeChange = window.sable.onWorkspaceTreeChanged((rootDir) => {
      void refreshWorkspaceTree(rootDir)
    })

    return () => {
      unsubMenu()
      unsubOpenReq()
      unsubExtChange()
      unsubTreeChange()
    }
  }, [executeMenuCommand, openFileByPath, refreshWorkspaceTree])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <TitleMenuBar isDark={darkTheme} onCommand={executeMenuCommand} />

      {preferences.showTabBar && (
        <TabBar isDark={darkTheme} onCloseTabRequest={(id) => void handleCloseTabRequest(id)} />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {preferences.showSidebar && (
          <Sidebar
            isDark={darkTheme}
            onSelectFile={(fp) => void openFileByPath(fp)}
            onOpenFolder={() => void handleOpenFolder()}
            onRefreshWorkspace={() => void refreshWorkspaceTree(workspaceDir)}
            onJumpToHeading={(pos) => {
              if (preferences.sourceCodeMode) {
                updatePreferences({ sourceCodeMode: false })
                setTimeout(() => liveEditorRef.current?.jumpToPos(pos), 60)
              } else {
                liveEditorRef.current?.jumpToPos(pos)
              }
            }}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {preferences.sourceCodeMode ? (
            <SourceEditor
              key={`source-${activeTabId}`}
              value={activeTab.content}
              initialScrollRatio={activeTab.scrollRatio}
              openFindTrigger={sourceFindTrigger}
              onChange={(nextMd, ratio) => updateActiveContent(nextMd, ratio)}
            />
          ) : (
            <LiveEditor
              ref={liveEditorRef}
              tabId={activeTabId}
              markdown={activeTab.content}
              docPath={activeTab.filePath}
              initialScrollRatio={activeTab.scrollRatio}
              inlineSyntaxReveal={preferences.inlineSyntaxReveal}
              focusMode={preferences.focusMode}
              typewriterMode={preferences.typewriterMode}
              showFloatingToolbar={preferences.showFloatingToolbar}
              enableSlashMenu={preferences.enableSlashMenu}
              imageAction={preferences.imageAction}
              customImageDir={preferences.customImageDir}
              showFindBar={showFindBar}
              onCloseFindBar={() => setShowFindBar(false)}
              onChange={(nextMd, ratio) => updateActiveContent(nextMd, ratio)}
              onHeadingsChange={setHeadings}
              onOpenDroppedMarkdown={(fp) => void openFileByPath(fp)}
            />
          )}
        </main>
      </div>

      <StatusBar
        isDark={darkTheme}
        onToggleSourceMode={() =>
          updatePreferences({ sourceCodeMode: !preferences.sourceCodeMode })
        }
      />

      <PreferencesModal isDark={darkTheme} />
      <ShortcutsModal isDark={darkTheme} />
      <AboutModal isDark={darkTheme} />
    </div>
  )
}
