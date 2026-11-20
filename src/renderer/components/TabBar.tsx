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
      className={`flex h-9 shrink-0 items-center overflow-x-auto border-b px-1.5 select-none ${
        isDark
          ? 'border-neutral-800 bg-[#14161a] text-neutral-300'
          : 'border-neutral-200/90 bg-[#f3f4f6] text-neutral-700'
      }`}
    >
      <div className="flex items-center gap-1">
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
              className={`group flex max-w-52 min-w-28 cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1 text-xs transition ${
                active
                  ? isDark
                    ? 'bg-[#1f232a] font-medium text-white shadow-2xs'
                    : 'bg-white font-medium text-neutral-900 shadow-2xs'
                  : 'opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5'
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
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        title="新建标签页 (Ctrl+N)"
        onClick={() => createNewTab(false)}
        className="ml-1 rounded p-1.5 opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
