import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import path from 'path'
import { BUILTIN_THEMES, DEFAULT_PREFERENCES } from '@shared/defaults'
import type { MenuCommand, MenuSyncState } from '@shared/types'

let latestMenuState: MenuSyncState = {
  showSidebar: DEFAULT_PREFERENCES.showSidebar,
  sidebarTab: DEFAULT_PREFERENCES.sidebarTab,
  showTabBar: DEFAULT_PREFERENCES.showTabBar,
  sourceCodeMode: DEFAULT_PREFERENCES.sourceCodeMode,
  focusMode: DEFAULT_PREFERENCES.focusMode,
  typewriterMode: DEFAULT_PREFERENCES.typewriterMode,
  theme: DEFAULT_PREFERENCES.theme,
  customThemes: [],
  recentFiles: []
}

function dispatchToFocusedWindow(
  command: MenuCommand,
  payload?: string,
  createWindowFallback?: () => BrowserWindow
): void {
  let target = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (!target && createWindowFallback) {
    target = createWindowFallback()
  }
  if (target && !target.isDestroyed()) {
    target.webContents.send('sable:menu-command', command, payload)
  }
}

export function buildAndApplyApplicationMenu(
  stateUpdate?: Partial<MenuSyncState>,
  onCreateNewWindow?: () => BrowserWindow
): void {
  if (stateUpdate) {
    latestMenuState = { ...latestMenuState, ...stateUpdate }
  }

  const recentItems: MenuItemConstructorOptions[] =
    latestMenuState.recentFiles.length > 0
      ? [
          ...latestMenuState.recentFiles.map((filePath) => ({
            label: `${path.basename(filePath)}  —  ${path.dirname(filePath)}`,
            click: (): void =>
              dispatchToFocusedWindow('file:open-recent', filePath, onCreateNewWindow)
          })),
          { type: 'separator' },
          {
            label: '清空最近打开记录',
            click: (): void => dispatchToFocusedWindow('file:clear-recent')
          }
        ]
      : [{ label: '暂无最近打开文档', enabled: false }]

  const themeItems: MenuItemConstructorOptions[] = [
    ...BUILTIN_THEMES.map((t) => ({
      label: t.name,
      type: 'radio' as const,
      checked: latestMenuState.theme === t.id,
      click: (): void => dispatchToFocusedWindow('theme:select', t.id)
    })),
    ...(latestMenuState.customThemes.length > 0
      ? [
          { type: 'separator' as const },
          ...latestMenuState.customThemes.map((t) => ({
            label: t.name,
            type: 'radio' as const,
            checked: latestMenuState.theme === t.id,
            click: (): void => dispatchToFocusedWindow('theme:select', t.id)
          }))
        ]
      : []),
    { type: 'separator' },
    {
      label: '刷新主题列表',
      click: (): void => dispatchToFocusedWindow('theme:refresh')
    },
    {
      label: '打开本地主题文件夹...',
      click: (): void => dispatchToFocusedWindow('theme:open-folder')
    }
  ]

  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建文档',
          accelerator: 'CmdOrCtrl+N',
          click: (): void => dispatchToFocusedWindow('file:new', undefined, onCreateNewWindow)
        },
        {
          label: '新建窗口',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: (): void => {
            if (onCreateNewWindow) {
              onCreateNewWindow()
            } else {
              dispatchToFocusedWindow('file:new-window')
            }
          }
        },
        { type: 'separator' },
        {
          label: '打开文件...',
          accelerator: 'CmdOrCtrl+O',
          click: (): void => dispatchToFocusedWindow('file:open', undefined, onCreateNewWindow)
        },
        {
          label: '打开文件夹...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: (): void =>
            dispatchToFocusedWindow('file:open-folder', undefined, onCreateNewWindow)
        },
        {
          label: '最近打开',
          submenu: recentItems
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: (): void => dispatchToFocusedWindow('file:save')
        },
        {
          label: '另存为...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: (): void => dispatchToFocusedWindow('file:save-as')
        },
        { type: 'separator' },
        {
          label: '导出为 PDF...',
          accelerator: 'CmdOrCtrl+Alt+P',
          click: (): void => dispatchToFocusedWindow('file:export-pdf')
        },
        {
          label: '导出为 HTML...',
          accelerator: 'CmdOrCtrl+Alt+H',
          click: (): void => dispatchToFocusedWindow('file:export-html')
        },
        {
          label: '导出为 Word (.docx)...',
          click: (): void => dispatchToFocusedWindow('file:export-docx')
        },
        {
          label: '导出为 LaTeX (.tex)...',
          click: (): void => dispatchToFocusedWindow('file:export-latex')
        },
        { type: 'separator' },
        {
          label: '偏好设置...',
          accelerator: 'CmdOrCtrl+,',
          click: (): void => dispatchToFocusedWindow('file:preferences')
        },
        { type: 'separator' },
        {
          label: '退出',
          role: 'quit'
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          accelerator: 'CmdOrCtrl+Z',
          click: (): void => dispatchToFocusedWindow('edit:undo')
        },
        {
          label: '重做',
          accelerator: 'CmdOrCtrl+Y',
          click: (): void => dispatchToFocusedWindow('edit:redo')
        },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '粘贴为纯文本', role: 'pasteAndMatchStyle' },
        {
          label: '复制为 Markdown',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: (): void => dispatchToFocusedWindow('edit:copy-markdown')
        },
        {
          label: '复制为 HTML 代码',
          click: (): void => dispatchToFocusedWindow('edit:copy-html')
        },
        { type: 'separator' },
        { label: '全选', role: 'selectAll' },
        {
          label: '查找与替换',
          accelerator: 'CmdOrCtrl+F',
          click: (): void => dispatchToFocusedWindow('edit:find')
        }
      ]
    },
    {
      label: '段落',
      submenu: [
        {
          label: '一级标题',
          accelerator: 'CmdOrCtrl+1',
          click: (): void => dispatchToFocusedWindow('para:heading-1')
        },
        {
          label: '二级标题',
          accelerator: 'CmdOrCtrl+2',
          click: (): void => dispatchToFocusedWindow('para:heading-2')
        },
        {
          label: '三级标题',
          accelerator: 'CmdOrCtrl+3',
          click: (): void => dispatchToFocusedWindow('para:heading-3')
        },
        {
          label: '四级标题',
          accelerator: 'CmdOrCtrl+4',
          click: (): void => dispatchToFocusedWindow('para:heading-4')
        },
        {
          label: '五级标题',
          accelerator: 'CmdOrCtrl+5',
          click: (): void => dispatchToFocusedWindow('para:heading-5')
        },
        {
          label: '六级标题',
          accelerator: 'CmdOrCtrl+6',
          click: (): void => dispatchToFocusedWindow('para:heading-6')
        },
        {
          label: '普通段落',
          accelerator: 'CmdOrCtrl+0',
          click: (): void => dispatchToFocusedWindow('para:paragraph')
        },
        { type: 'separator' },
        {
          label: '提升标题级别',
          accelerator: 'CmdOrCtrl+=',
          click: (): void => dispatchToFocusedWindow('para:heading-promote')
        },
        {
          label: '降低标题级别',
          accelerator: 'CmdOrCtrl+-',
          click: (): void => dispatchToFocusedWindow('para:heading-demote')
        },
        { type: 'separator' },
        {
          label: '插入表格',
          accelerator: 'CmdOrCtrl+T',
          click: (): void => dispatchToFocusedWindow('para:table')
        },
        {
          label: '代码块',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: (): void => dispatchToFocusedWindow('para:code-block')
        },
        {
          label: '数学公式块',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: (): void => dispatchToFocusedWindow('para:math-block')
        },
        {
          label: 'Mermaid 图表块',
          click: (): void => dispatchToFocusedWindow('para:mermaid-block')
        },
        {
          label: '引用块',
          accelerator: 'CmdOrCtrl+Shift+Q',
          click: (): void => dispatchToFocusedWindow('para:blockquote')
        },
        { type: 'separator' },
        {
          label: '有序列表',
          accelerator: 'CmdOrCtrl+Shift+[',
          click: (): void => dispatchToFocusedWindow('para:ordered-list')
        },
        {
          label: '无序列表',
          accelerator: 'CmdOrCtrl+Shift+]',
          click: (): void => dispatchToFocusedWindow('para:bullet-list')
        },
        {
          label: '任务列表',
          accelerator: 'CmdOrCtrl+Shift+X',
          click: (): void => dispatchToFocusedWindow('para:task-list')
        },
        { type: 'separator' },
        {
          label: '插入目录 [TOC]',
          click: (): void => dispatchToFocusedWindow('para:toc')
        },
        {
          label: '水平分割线',
          click: (): void => dispatchToFocusedWindow('para:hr')
        }
      ]
    },
    {
      label: '格式',
      submenu: [
        {
          label: '加粗',
          accelerator: 'CmdOrCtrl+B',
          click: (): void => dispatchToFocusedWindow('format:strong')
        },
        {
          label: '斜体',
          accelerator: 'CmdOrCtrl+I',
          click: (): void => dispatchToFocusedWindow('format:em')
        },
        {
          label: '删除线',
          accelerator: 'Alt+Shift+5',
          click: (): void => dispatchToFocusedWindow('format:strike')
        },
        {
          label: '上标',
          click: (): void => dispatchToFocusedWindow('format:sup')
        },
        {
          label: '下标',
          click: (): void => dispatchToFocusedWindow('format:sub')
        },
        {
          label: '行内代码',
          accelerator: 'CmdOrCtrl+`',
          click: (): void => dispatchToFocusedWindow('format:code')
        },
        {
          label: '行内公式',
          click: (): void => dispatchToFocusedWindow('format:math-inline')
        },
        {
          label: '插入脚注',
          click: (): void => dispatchToFocusedWindow('format:footnote')
        },
        { type: 'separator' },
        {
          label: '超链接',
          accelerator: 'CmdOrCtrl+K',
          click: (): void => dispatchToFocusedWindow('format:link')
        },
        {
          label: '插入图片...',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: (): void => dispatchToFocusedWindow('format:image')
        },
        { type: 'separator' },
        {
          label: '清除行内样式',
          accelerator: 'CmdOrCtrl+\\',
          click: (): void => dispatchToFocusedWindow('format:clear')
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '显示侧边栏',
          type: 'checkbox',
          checked: latestMenuState.showSidebar,
          accelerator: 'CmdOrCtrl+Shift+L',
          click: (): void => dispatchToFocusedWindow('view:toggle-sidebar')
        },
        {
          label: 'Outline 大纲面板',
          type: 'radio',
          checked: latestMenuState.showSidebar && latestMenuState.sidebarTab === 'outline',
          click: (): void => dispatchToFocusedWindow('view:outline')
        },
        {
          label: 'File Tree 文件树面板',
          type: 'radio',
          checked: latestMenuState.showSidebar && latestMenuState.sidebarTab === 'files',
          click: (): void => dispatchToFocusedWindow('view:files')
        },
        { type: 'separator' },
        {
          label: '显示顶部多标签页',
          type: 'checkbox',
          checked: latestMenuState.showTabBar,
          click: (): void => dispatchToFocusedWindow('view:toggle-tabs')
        },
        { type: 'separator' },
        {
          label: 'Source Code Mode',
          type: 'checkbox',
          checked: latestMenuState.sourceCodeMode,
          accelerator: 'CmdOrCtrl+/',
          click: (): void => dispatchToFocusedWindow('view:toggle-source')
        },
        {
          label: 'Focus Mode',
          type: 'checkbox',
          checked: latestMenuState.focusMode,
          accelerator: 'F8',
          click: (): void => dispatchToFocusedWindow('view:toggle-focus')
        },
        {
          label: 'Typewriter Mode',
          type: 'checkbox',
          checked: latestMenuState.typewriterMode,
          accelerator: 'F9',
          click: (): void => dispatchToFocusedWindow('view:toggle-typewriter')
        },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大视图', role: 'zoomIn' },
        { label: '缩小视图', role: 'zoomOut' },
        { label: '切换全屏', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '切换开发者工具', role: 'toggleDevTools' }
      ]
    },
    {
      label: '主题',
      submenu: themeItems
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '快捷键速查',
          click: (): void => dispatchToFocusedWindow('help:shortcuts')
        },
        {
          label: 'Markdown 语法示例',
          click: (): void => dispatchToFocusedWindow('help:markdown-guide')
        },
        { type: 'separator' },
        {
          label: '关于 Sable',
          click: (): void => dispatchToFocusedWindow('help:about')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
