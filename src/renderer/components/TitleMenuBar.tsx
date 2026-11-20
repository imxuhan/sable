import React, { useEffect, useRef, useState } from 'react'
import { Check, Copy, Minus, Square, X } from 'lucide-react'
import { BUILTIN_THEMES } from '@shared/defaults'
import type { MenuCommand } from '@shared/types'
import { useEditorStore } from '../stores/useEditorStore'

interface MenuEntry {
  type?: 'item' | 'separator' | 'header'
  label?: string
  shortcut?: string
  checked?: boolean
  disabled?: boolean
  cmd?: MenuCommand
  payload?: string
  customAction?: () => void
}

interface TopMenuGroup {
  id: string
  label: string
  items: MenuEntry[]
}

interface TitleMenuBarProps {
  isDark: boolean
  onCommand: (cmd: MenuCommand, payload?: string) => void
}

export const TitleMenuBar: React.FC<TitleMenuBarProps> = ({ isDark, onCommand }) => {
  const { preferences, customThemes, recentFiles, getActiveTab } = useEditorStore()
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [maximized, setMaximized] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)

  const activeTab = getActiveTab()
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)

  useEffect(() => {
    if (!window.sable) return
    void window.sable.isWindowMaximized().then(setMaximized)
    return window.sable.onWindowMaximizedChange(setMaximized)
  }, [])

  useEffect(() => {
    if (!openMenuId) return
    const onMouseDown = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpenMenuId(null)
      }
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenuId])

  if (isMac) {
    return null
  }

  const recentEntries: MenuEntry[] =
    recentFiles.length > 0
      ? [
          { type: 'header', label: '最近打开文档' },
          ...recentFiles.slice(0, 6).map((fp) => {
            const name = fp.split(/[\\/]/).pop() || fp
            return {
              label: name,
              cmd: 'file:open-recent' as MenuCommand,
              payload: fp
            }
          }),
          { label: '清空最近记录', cmd: 'file:clear-recent' }
        ]
      : []

  const menuGroups: TopMenuGroup[] = [
    {
      id: 'file',
      label: '文件',
      items: [
        { label: '新建文档', shortcut: 'Ctrl+N', cmd: 'file:new' },
        {
          label: '新建窗口',
          shortcut: 'Ctrl+Shift+N',
          customAction: () => window.sable && void window.sable.createNewWindow()
        },
        { type: 'separator' },
        { label: '打开文件...', shortcut: 'Ctrl+O', cmd: 'file:open' },
        { label: '打开文件夹...', shortcut: 'Ctrl+Shift+O', cmd: 'file:open-folder' },
        ...(recentEntries.length > 0 ? [{ type: 'separator' as const }, ...recentEntries] : []),
        { type: 'separator' },
        { label: '保存', shortcut: 'Ctrl+S', cmd: 'file:save' },
        { label: '另存为...', shortcut: 'Ctrl+Shift+S', cmd: 'file:save-as' },
        { type: 'separator' },
        { label: '导出为 PDF...', shortcut: 'Ctrl+Alt+P', cmd: 'file:export-pdf' },
        { label: '导出为 HTML...', shortcut: 'Ctrl+Alt+H', cmd: 'file:export-html' },
        { type: 'separator' },
        { label: '偏好设置...', shortcut: 'Ctrl+,', cmd: 'file:preferences' },
        { type: 'separator' },
        {
          label: '退出窗口',
          customAction: () => window.sable && void window.sable.windowClose()
        }
      ]
    },
    {
      id: 'edit',
      label: '编辑',
      items: [
        { label: '撤销', shortcut: 'Ctrl+Z', cmd: 'edit:undo' },
        { label: '重做', shortcut: 'Ctrl+Y', cmd: 'edit:redo' },
        { type: 'separator' },
        { label: '复制为 Markdown', shortcut: 'Ctrl+Shift+C', cmd: 'edit:copy-markdown' },
        { label: '复制为 HTML 代码', cmd: 'edit:copy-html' },
        { type: 'separator' },
        { label: '查找与替换', shortcut: 'Ctrl+F', cmd: 'edit:find' }
      ]
    },
    {
      id: 'paragraph',
      label: '段落',
      items: [
        { label: '一级标题', shortcut: 'Ctrl+1', cmd: 'para:heading-1' },
        { label: '二级标题', shortcut: 'Ctrl+2', cmd: 'para:heading-2' },
        { label: '三级标题', shortcut: 'Ctrl+3', cmd: 'para:heading-3' },
        { label: '四级标题', shortcut: 'Ctrl+4', cmd: 'para:heading-4' },
        { label: '五级标题', shortcut: 'Ctrl+5', cmd: 'para:heading-5' },
        { label: '六级标题', shortcut: 'Ctrl+6', cmd: 'para:heading-6' },
        { label: '普通段落', shortcut: 'Ctrl+0', cmd: 'para:paragraph' },
        { type: 'separator' },
        { label: '提升标题级别', shortcut: 'Ctrl+=', cmd: 'para:heading-promote' },
        { label: '降低标题级别', shortcut: 'Ctrl+-', cmd: 'para:heading-demote' },
        { type: 'separator' },
        { label: '插入表格', shortcut: 'Ctrl+T', cmd: 'para:table' },
        { label: '代码块', shortcut: 'Ctrl+Shift+K', cmd: 'para:code-block' },
        { label: '数学公式块', shortcut: 'Ctrl+Shift+M', cmd: 'para:math-block' },
        { label: 'Mermaid 图表块', cmd: 'para:mermaid-block' },
        { label: '引用块', shortcut: 'Ctrl+Shift+Q', cmd: 'para:blockquote' },
        { type: 'separator' },
        { label: '有序列表', shortcut: 'Ctrl+Shift+[', cmd: 'para:ordered-list' },
        { label: '无序列表', shortcut: 'Ctrl+Shift+]', cmd: 'para:bullet-list' },
        { label: '任务列表', shortcut: 'Ctrl+Shift+X', cmd: 'para:task-list' },
        { type: 'separator' },
        { label: '插入目录 [TOC]', cmd: 'para:toc' },
        { label: '水平分割线', cmd: 'para:hr' }
      ]
    },
    {
      id: 'format',
      label: '格式',
      items: [
        { label: '加粗', shortcut: 'Ctrl+B', cmd: 'format:strong' },
        { label: '斜体', shortcut: 'Ctrl+I', cmd: 'format:em' },
        { label: '删除线', shortcut: 'Alt+Shift+5', cmd: 'format:strike' },
        { label: '行内代码', shortcut: 'Ctrl+`', cmd: 'format:code' },
        { label: '行内公式', cmd: 'format:math-inline' },
        { type: 'separator' },
        { label: '超链接', shortcut: 'Ctrl+K', cmd: 'format:link' },
        { label: '插入图片...', shortcut: 'Ctrl+Shift+I', cmd: 'format:image' },
        { type: 'separator' },
        { label: '清除行内样式', shortcut: 'Ctrl+\\', cmd: 'format:clear' }
      ]
    },
    {
      id: 'view',
      label: '视图',
      items: [
        {
          label: '显示侧边栏',
          shortcut: 'Ctrl+Shift+L',
          checked: preferences.showSidebar,
          cmd: 'view:toggle-sidebar'
        },
        {
          label: 'Outline 大纲面板',
          checked: preferences.showSidebar && preferences.sidebarTab === 'outline',
          cmd: 'view:outline'
        },
        {
          label: 'File Tree 文件面板',
          checked: preferences.showSidebar && preferences.sidebarTab === 'files',
          cmd: 'view:files'
        },
        { type: 'separator' },
        {
          label: '显示顶部多标签页',
          checked: preferences.showTabBar,
          cmd: 'view:toggle-tabs'
        },
        { type: 'separator' },
        {
          label: 'Source Code Mode',
          shortcut: 'Ctrl+/',
          checked: preferences.sourceCodeMode,
          cmd: 'view:toggle-source'
        },
        {
          label: 'Focus Mode',
          shortcut: 'F8',
          checked: preferences.focusMode,
          cmd: 'view:toggle-focus'
        },
        {
          label: 'Typewriter Mode',
          shortcut: 'F9',
          checked: preferences.typewriterMode,
          cmd: 'view:toggle-typewriter'
        },
        { type: 'separator' },
        {
          label: '放大界面缩放',
          shortcut: 'Ctrl+滚轮上',
          cmd: 'view:zoom-in'
        },
        {
          label: '缩小界面缩放',
          shortcut: 'Ctrl+滚轮下',
          cmd: 'view:zoom-out'
        },
        {
          label: `恢复默认缩放 (118%)`,
          cmd: 'view:zoom-reset'
        }
      ]
    },
    {
      id: 'theme',
      label: '主题',
      items: [
        ...BUILTIN_THEMES.map((t) => ({
          label: t.name,
          checked: preferences.theme === t.id,
          cmd: 'theme:select' as MenuCommand,
          payload: t.id
        })),
        ...(customThemes.length > 0
          ? [
              { type: 'separator' as const },
              ...customThemes.map((t) => ({
                label: t.name,
                checked: preferences.theme === t.id,
                cmd: 'theme:select' as MenuCommand,
                payload: t.id
              }))
            ]
          : []),
        { type: 'separator' },
        { label: '刷新主题列表', cmd: 'theme:refresh' },
        { label: '打开本地主题文件夹...', cmd: 'theme:open-folder' }
      ]
    },
    {
      id: 'help',
      label: '帮助',
      items: [
        { label: '快捷键速查', cmd: 'help:shortcuts' },
        { label: 'Markdown 语法示例', cmd: 'help:markdown-guide' },
        { type: 'separator' },
        { label: '关于 Sable', cmd: 'help:about' }
      ]
    }
  ]

  return (
    <header
      ref={barRef}
      style={{ fontSize: 'var(--sable-ui-font-size, 14.5px)' }}
      className={`sable-titlebar relative z-40 flex h-[2.65em] shrink-0 items-center justify-between border-b select-none ${
        isDark
          ? 'border-neutral-800 bg-[#14161a] text-neutral-200'
          : 'border-neutral-200/90 bg-[#f6f7f9] text-neutral-800'
      }`}
    >
      <div className="sable-no-drag flex h-full items-center pl-3">
        <div className="mr-2.5 flex h-[1.55em] w-[1.55em] items-center justify-center rounded-md bg-neutral-900 font-serif text-[0.85em] font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
          S
        </div>

        <nav className="flex h-full items-center gap-0.5">
          {menuGroups.map((group) => {
            const isOpen = openMenuId === group.id
            return (
              <div key={group.id} className="relative flex h-full items-center">
                <button
                  type="button"
                  onClick={() => setOpenMenuId(isOpen ? null : group.id)}
                  onMouseEnter={() => {
                    if (openMenuId && openMenuId !== group.id) {
                      setOpenMenuId(group.id)
                    }
                  }}
                  className={`rounded-md px-2.5 py-1 font-normal transition ${
                    isOpen
                      ? isDark
                        ? 'bg-neutral-700/80 text-white'
                        : 'bg-neutral-200/90 text-neutral-950'
                      : 'hover:bg-black/6 dark:hover:bg-white/8'
                  }`}
                >
                  {group.label}
                </button>

                {isOpen && (
                  <div
                    style={{ fontSize: 'var(--sable-ui-font-size, 14.5px)' }}
                    className={`absolute top-full left-0 mt-0.5 max-h-[78vh] min-w-60 overflow-y-auto rounded-lg border py-1.5 shadow-xl ${
                      isDark
                        ? 'border-neutral-700 bg-[#1e2128] text-neutral-100'
                        : 'border-neutral-200 bg-white text-neutral-800'
                    }`}
                  >
                    {group.items.map((item, idx) => {
                      if (item.type === 'separator') {
                        return (
                          <div
                            key={`sep-${idx}`}
                            className="my-1 h-px bg-black/8 dark:bg-white/10"
                          />
                        )
                      }
                      if (item.type === 'header') {
                        return (
                          <div
                            key={`hdr-${idx}`}
                            className="px-3 py-1 text-[0.8em] font-medium opacity-50"
                          >
                            {item.label}
                          </div>
                        )
                      }
                      return (
                        <button
                          key={`${item.label}-${idx}`}
                          type="button"
                          disabled={item.disabled}
                          onClick={() => {
                            setOpenMenuId(null)
                            if (item.customAction) {
                              item.customAction()
                            } else if (item.cmd) {
                              onCommand(item.cmd, item.payload)
                            }
                          }}
                          className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left transition hover:bg-blue-500/12 hover:text-blue-600 dark:hover:bg-blue-400/15 dark:hover:text-blue-300"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <span className="flex w-4 shrink-0 items-center justify-center">
                              {item.checked ? <Check className="h-3.5 w-3.5" /> : null}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.shortcut && (
                            <span className="shrink-0 font-mono text-[0.82em] opacity-55">
                              {item.shortcut}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      <div
        onDoubleClick={() => {
          if (window.sable) {
            void window.sable.windowToggleMaximize().then(setMaximized)
          }
        }}
        className="flex min-w-0 flex-1 items-center justify-center px-4"
      >
        <span className="truncate text-[0.92em] font-medium opacity-75">
          {activeTab.isDirty ? '● ' : ''}
          {activeTab.title}
        </span>
      </div>

      <div className="sable-no-drag flex h-full items-stretch">
        <button
          type="button"
          title="最小化"
          onClick={() => window.sable && void window.sable.windowMinimize()}
          className="flex w-11 items-center justify-center opacity-75 transition hover:bg-black/8 hover:opacity-100 dark:hover:bg-white/10"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={maximized ? '向下还原' : '最大化'}
          onClick={() =>
            window.sable && void window.sable.windowToggleMaximize().then(setMaximized)
          }
          className="flex w-11 items-center justify-center opacity-75 transition hover:bg-black/8 hover:opacity-100 dark:hover:bg-white/10"
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          title="关闭"
          onClick={() => window.sable && void window.sable.windowClose()}
          className="flex w-11 items-center justify-center opacity-75 transition hover:bg-red-600 hover:text-white hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
