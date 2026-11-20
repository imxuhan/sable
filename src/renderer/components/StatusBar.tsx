import React, { useState } from 'react'
import { Code2, Eye, PanelLeft } from 'lucide-react'
import { useEditorStore } from '../stores/useEditorStore'

interface StatusBarProps {
  isDark: boolean
  onToggleSourceMode: () => void
}

export const StatusBar: React.FC<StatusBarProps> = ({ isDark, onToggleSourceMode }) => {
  const { preferences, updatePreferences, stats, statusToast, getActiveTab } = useEditorStore()
  const [showStatsPopover, setShowStatsPopover] = useState(false)
  const activeTab = getActiveTab()

  return (
    <footer
      style={{ fontSize: 'calc(var(--sable-ui-font-size, 14.5px) * 0.88)' }}
      className={`relative flex h-8 shrink-0 items-center justify-between border-t px-3.5 select-none ${
        isDark
          ? 'border-neutral-800 bg-[#16181d] text-neutral-400'
          : 'border-neutral-200/80 bg-[#fafafa] text-neutral-500'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          title="显示或隐藏侧边栏 (Ctrl+Shift+L)"
          onClick={() => updatePreferences({ showSidebar: !preferences.showSidebar })}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-black/5 dark:hover:bg-white/5 ${
            preferences.showSidebar ? 'text-blue-600 dark:text-blue-400' : ''
          }`}
        >
          <PanelLeft className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          title="切换 Source Code Mode (Ctrl+/)"
          onClick={onToggleSourceMode}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-black/5 dark:hover:bg-white/5 ${
            preferences.sourceCodeMode ? 'font-medium text-blue-600 dark:text-blue-400' : ''
          }`}
        >
          <Code2 className="h-3.5 w-3.5" />
          <span>{preferences.sourceCodeMode ? '退出源码模式' : '源码'}</span>
        </button>

        {preferences.focusMode && (
          <button
            type="button"
            onClick={() => updatePreferences({ focusMode: false })}
            className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-300"
            title="点击关闭 Focus Mode (F8)"
          >
            <Eye className="h-3 w-3" />
            <span>Focus</span>
          </button>
        )}

        {preferences.typewriterMode && (
          <button
            type="button"
            onClick={() => updatePreferences({ typewriterMode: false })}
            className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-300"
            title="点击关闭 Typewriter Mode (F9)"
          >
            Typewriter
          </button>
        )}

        {statusToast && (
          <span className="ml-2 text-emerald-600 dark:text-emerald-400">{statusToast}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="opacity-70">
          {activeTab.filePath
            ? activeTab.isDirty
              ? '待保存'
              : '已保存'
            : '本地草稿'}
        </span>

        <button
          type="button"
          onClick={() => setShowStatsPopover(!showStatsPopover)}
          className="rounded px-1.5 py-0.5 hover:bg-black/5 dark:hover:bg-white/5"
        >
          {stats.words} 词
        </button>
      </div>

      {showStatsPopover && (
        <div
          onMouseLeave={() => setShowStatsPopover(false)}
          className={`absolute right-3 bottom-8 z-40 w-52 rounded-lg border p-3 text-xs shadow-lg ${
            isDark
              ? 'border-neutral-700 bg-neutral-800 text-neutral-200'
              : 'border-neutral-200 bg-white text-neutral-700'
          }`}
        >
          <div className="mb-2 font-semibold">文档统计</div>
          <div className="flex justify-between py-0.5">
            <span className="opacity-70">词数</span>
            <span className="font-mono">{stats.words}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="opacity-70">非空白字符</span>
            <span className="font-mono">{stats.chars}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="opacity-70">总行数</span>
            <span className="font-mono">{stats.lines}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="opacity-70">预计阅读时长</span>
            <span>约 {stats.readingMinutes} 分钟</span>
          </div>
        </div>
      )}
    </footer>
  )
}
