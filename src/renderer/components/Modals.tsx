import React from 'react'
import { X, FolderOpen } from 'lucide-react'
import { BUILTIN_THEMES } from '@shared/defaults'
import type { ImageSaveAction, PdfMargins, PdfPageSize } from '@shared/types'
import { useEditorStore } from '../stores/useEditorStore'

export const PreferencesModal: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const {
    showPreferencesModal,
    setShowPreferencesModal,
    preferences,
    updatePreferences,
    customThemes
  } = useEditorStore()

  if (!showPreferencesModal) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onClick={() => setShowPreferencesModal(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border p-6 shadow-2xl ${
          isDark
            ? 'border-neutral-700 bg-[#1c1f26] text-neutral-100'
            : 'border-neutral-200 bg-white text-neutral-800'
        }`}
      >
        <div className="mb-5 flex items-center justify-between border-b border-black/10 pb-3 dark:border-white/10">
          <h2 className="text-base font-semibold">Sable 偏好设置</h2>
          <button
            type="button"
            onClick={() => setShowPreferencesModal(false)}
            className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 text-xs">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide uppercase opacity-60">
              文件与保存
            </h3>
            <label className="flex items-center justify-between">
              <span>启用实时自动保存（停止输入或失焦时自动写入磁盘）</span>
              <input
                type="checkbox"
                checked={preferences.autoSave}
                onChange={(e) => updatePreferences({ autoSave: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>显示窗口顶部多标签页</span>
              <input
                type="checkbox"
                checked={preferences.showTabBar}
                onChange={(e) => updatePreferences({ showTabBar: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          </section>

          <section className="space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
            <h3 className="text-xs font-semibold tracking-wide uppercase opacity-60">
              编辑器与交互手感
            </h3>
            <label className="flex items-center justify-between">
              <span>光标移入加粗或链接等行内格式时动态展开 Markdown 语法</span>
              <input
                type="checkbox"
                checked={preferences.inlineSyntaxReveal}
                onChange={(e) => updatePreferences({ inlineSyntaxReveal: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>选中文字时弹出轻量浮动格式工具条</span>
              <input
                type="checkbox"
                checked={preferences.showFloatingToolbar}
                onChange={(e) => updatePreferences({ showFloatingToolbar: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between">
              <span>在空行输入斜杠 (/) 时弹出快捷块插入菜单</span>
              <input
                type="checkbox"
                checked={preferences.enableSlashMenu}
                onChange={(e) => updatePreferences({ enableSlashMenu: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            <div className="flex items-center justify-between">
              <span>编辑区基准字号 ({preferences.fontSize}px)</span>
              <input
                type="range"
                min={13}
                max={22}
                value={preferences.fontSize}
                onChange={(e) => updatePreferences({ fontSize: Number(e.target.value) })}
                className="w-36 accent-blue-600"
              />
            </div>
          </section>

          <section className="space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
            <h3 className="text-xs font-semibold tracking-wide uppercase opacity-60">
              本地图片存储规则
            </h3>
            <div className="flex items-center justify-between gap-4">
              <span>粘贴截图或拖入外部图片时</span>
              <select
                value={preferences.imageAction}
                onChange={(e) =>
                  updatePreferences({ imageAction: e.target.value as ImageSaveAction })
                }
                className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 outline-none dark:border-neutral-600 dark:bg-neutral-800"
              >
                <option value="copy-doc-assets">复制到同级 ${'{filename}'}.assets 文件夹</option>
                <option value="copy-custom-dir">复制到指定相对或绝对目录</option>
                <option value="keep-original">直接引用原始图片路径</option>
              </select>
            </div>
            {preferences.imageAction === 'copy-custom-dir' && (
              <div className="flex items-center justify-between gap-4">
                <span>自定义图片目录路径</span>
                <input
                  type="text"
                  value={preferences.customImageDir}
                  onChange={(e) => updatePreferences({ customImageDir: e.target.value })}
                  placeholder="./assets"
                  className="w-52 rounded-md border border-neutral-300 bg-transparent px-2 py-1 outline-none dark:border-neutral-600"
                />
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-black/10 pt-4 dark:border-white/10">
            <h3 className="text-xs font-semibold tracking-wide uppercase opacity-60">
              主题与导出设置
            </h3>
            <div className="flex items-center justify-between">
              <span>当前排版主题</span>
              <div className="flex items-center gap-2">
                <select
                  value={preferences.theme}
                  onChange={(e) => updatePreferences({ theme: e.target.value })}
                  className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 outline-none dark:border-neutral-600 dark:bg-neutral-800"
                >
                  {BUILTIN_THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                  {customThemes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (自定义)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => window.sable && void window.sable.openThemesFolder()}
                  className="flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 hover:bg-black/5 dark:border-neutral-600 dark:hover:bg-white/5"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>主题目录</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span>导出 PDF 纸张尺寸与边距</span>
              <div className="flex items-center gap-2">
                <select
                  value={preferences.pdfPageSize}
                  onChange={(e) =>
                    updatePreferences({ pdfPageSize: e.target.value as PdfPageSize })
                  }
                  className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 outline-none dark:border-neutral-600 dark:bg-neutral-800"
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                </select>
                <select
                  value={preferences.pdfMargins}
                  onChange={(e) =>
                    updatePreferences({ pdfMargins: e.target.value as PdfMargins })
                  }
                  className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 outline-none dark:border-neutral-600 dark:bg-neutral-800"
                >
                  <option value="default">标准页边距</option>
                  <option value="compact">紧凑页边距</option>
                  <option value="wide">宽阔页边距</option>
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between">
              <span>导出单文件 HTML 时将本地图片编码为 Base64 内嵌</span>
              <input
                type="checkbox"
                checked={preferences.htmlEmbedImages}
                onChange={(e) => updatePreferences({ htmlEmbedImages: e.target.checked })}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          </section>
        </div>
      </div>
    </div>
  )
}

export const ShortcutsModal: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { showShortcutsModal, setShowShortcutsModal } = useEditorStore()
  if (!showShortcutsModal) return null

  const pairs = [
    ['Ctrl + N / Ctrl + Shift + N', '新建文档 / 新建窗口'],
    ['Ctrl + O / Ctrl + Shift + O', '打开文件 / 打开文件夹'],
    ['Ctrl + S / Ctrl + Shift + S', '保存 / 另存为'],
    ['Ctrl + /', '切换 Source Code Mode'],
    ['Ctrl + Shift + L', '显示或隐藏侧边栏'],
    ['F8 / F9', 'Focus Mode / Typewriter Mode'],
    ['Ctrl + 1 ~ 6 / Ctrl + 0', '一至六级标题 / 普通段落'],
    ['Ctrl + B / Ctrl + I', '加粗 / 斜体'],
    ['Ctrl + ` / Ctrl + K', '行内代码 / 插入链接'],
    ['Ctrl + T / Ctrl + Shift + K', '插入表格 / 插入代码块'],
    ['Ctrl + Shift + M / Ctrl + Shift + Q', '数学公式块 / 引用块'],
    ['Enter / Shift + Enter', '新建段落 / 段内软换行']
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onClick={() => setShowShortcutsModal(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-xl border p-5 shadow-2xl ${
          isDark
            ? 'border-neutral-700 bg-[#1c1f26] text-neutral-100'
            : 'border-neutral-200 bg-white text-neutral-800'
        }`}
      >
        <div className="mb-4 flex items-center justify-between border-b border-black/10 pb-2.5 dark:border-white/10">
          <h2 className="text-sm font-semibold">快捷键速查</h2>
          <button
            type="button"
            onClick={() => setShowShortcutsModal(false)}
            className="rounded p-1 opacity-70 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 text-xs">
          {pairs.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between py-0.5">
              <span className="opacity-75">{desc}</span>
              <kbd className="rounded border border-black/15 bg-black/5 px-1.5 py-0.5 font-mono text-[11px] dark:border-white/15 dark:bg-white/10">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const AboutModal: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { showAboutModal, setShowAboutModal } = useEditorStore()
  if (!showAboutModal) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onClick={() => setShowAboutModal(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-xl border p-6 text-center shadow-2xl ${
          isDark
            ? 'border-neutral-700 bg-[#1c1f26] text-neutral-100'
            : 'border-neutral-200 bg-white text-neutral-800'
        }`}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 font-serif text-xl font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
          S
        </div>
        <h2 className="text-lg font-semibold">Sable</h2>
        <p className="mt-1 text-xs opacity-60">Version 0.1.0 · MIT License</p>
        <p className="mt-3 text-xs leading-relaxed opacity-80">
          专注本地文档与纯粹即时渲染手感的桌面端 Markdown 编辑器。
        </p>
        <button
          type="button"
          onClick={() => setShowAboutModal(false)}
          className="mt-5 rounded-md bg-neutral-900 px-4 py-1.5 text-xs text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
        >
          关闭
        </button>
      </div>
    </div>
  )
}
