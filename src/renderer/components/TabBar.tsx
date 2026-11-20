import React from 'react'
import { Plus, X } from 'lucide-react'
import { useEditorStore } from '../stores/useEditorStore'

interface TabBarProps {
  isDark: boolean
  onCloseTabRequest: (tabId: string) => void
}

export const TabBar: React.FC<TabBarProps> = ({ isDark, onCloseTabRequest }) => {
  const { tabs, activeTabId, setActiveTab, createNewTab } = useEditorStore()

  return (
    <div
      style={{ fontSize: 'var(--sable-ui-font-size, 14.5px)' }}
      className={`shrink-0 border-b select-none ${
        isDark
          ? 'border-neutral-800 bg-[#16181e] text-neutral-300'
          : 'border-neutral-200/90 bg-[#f1f3f5] text-neutral-700'
      }`}
    >
      <div
        style={{ width: 'var(--sable-content-width, 90%)' }}
        className="mx-auto flex h-[2.6em] items-center overflow-x-auto px-7"
      >
        <div className="flex items-center gap-1.5">
          {tabs.map((tab) => {
            const active = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault()
                    onCloseTabRequest(tab.id)
                  }
                }}
                title={tab.filePath || tab.title}
                className={`group flex max-w-80 min-w-36 cursor-pointer items-center justify-between gap-3 rounded-md px-3.5 py-1 text-[0.94em] transition ${
                  active
                    ? isDark
                      ? 'bg-[#22262f] font-medium text-white shadow-xs'
                      : 'bg-white font-medium text-neutral-900 shadow-xs'
                    : 'opacity-72 hover:bg-black/6 hover:opacity-100 dark:hover:bg-white/6'
                }`}
              >
                <span className="truncate">
                  {tab.isDirty ? '● ' : ''}
                  {tab.title}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTabRequest(tab.id)
                  }}
                  className="rounded p-0.5 opacity-0 transition group-hover:opacity-70 hover:bg-black/10 hover:opacity-100! dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          title="新建标签页 (Ctrl+N)"
          onClick={() => createNewTab(false)}
          className="ml-1.5 rounded-md p-1.5 opacity-70 hover:bg-black/6 hover:opacity-100 dark:hover:bg-white/6"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
