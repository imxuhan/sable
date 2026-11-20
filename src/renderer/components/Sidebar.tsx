import React, { useEffect, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  ListTree,
  RefreshCw,
  Search,
  Trash2,
  Edit3
} from 'lucide-react'
import type { FileTreeNode, SidebarPanel } from '@shared/types'
import { useEditorStore } from '../stores/useEditorStore'

interface SidebarProps {
  isDark: boolean
  onSelectFile: (filePath: string) => void
  onOpenFolder: () => void
  onRefreshWorkspace: () => void
  onJumpToHeading: (pos: number) => void
}

const TreeItem: React.FC<{
  node: FileTreeNode
  activeFilePath: string | null
  depth: number
  onSelectFile: (filePath: string) => void
  onRefresh: () => void
}> = ({ node, activeFilePath, depth, onSelectFile, onRefresh }) => {
  const [expanded, setExpanded] = useState(depth < 1)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(node.name)

  const isActive =
    !node.isDirectory &&
    activeFilePath !== null &&
    activeFilePath.toLowerCase() === node.path.toLowerCase()

  const submitRename = async (): Promise<void> => {
    const trimmed = newName.trim()
    setRenaming(false)
    if (!trimmed || trimmed === node.name || !window.sable) return
    const sep = node.path.includes('\\') ? '\\' : '/'
    const parent = node.path.slice(0, node.path.lastIndexOf(sep))
    const renamed = await window.sable.renameEntry(node.path, `${parent}${sep}${trimmed}`)
    useEditorStore
      .getState()
      .applyEntryRenamed(node.path, renamed.newPath, renamed.updatedContent)
    if (renamed.updatedContent !== null) {
      useEditorStore.getState().flashToast('已重命名文档并同步更新 .assets 图片路径')
    }
    onRefresh()
  }

  const handleDelete = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (!window.sable) return
    const ok = window.confirm(`确定将 "${node.name}" 移入回收站吗？`)
    if (!ok) return
    await window.sable.deleteEntry(node.path)
    onRefresh()
  }

  return (
    <div>
      <div
        onClick={() => {
          if (node.isDirectory) {
            setExpanded(!expanded)
          } else {
            onSelectFile(node.path)
          }
        }}
        style={{ paddingLeft: `${12 + depth * 15}px` }}
        className={`group flex cursor-pointer items-center gap-1.5 py-1.5 pr-2.5 text-[0.93em] select-none ${
          isActive
            ? 'bg-blue-500/12 font-medium text-blue-600 dark:bg-blue-400/15 dark:text-blue-300'
            : 'hover:bg-black/5 dark:hover:bg-white/5'
        }`}
      >
        {node.isDirectory ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            )}
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500/90" />
          </>
        ) : (
          <>
            <span className="w-3.5 shrink-0" />
            <FileText className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </>
        )}

        {renaming ? (
          <input
            type="text"
            value={newName}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={() => void submitRename()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitRename()
              if (e.key === 'Escape') {
                setNewName(node.name)
                setRenaming(false)
              }
            }}
            className="min-w-0 flex-1 rounded border border-blue-500 bg-transparent px-1 py-0.5 text-xs outline-none"
          />
        ) : (
          <span className="truncate flex-1">{node.name}</span>
        )}

        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button
            type="button"
            title="重命名"
            onClick={(e) => {
              e.stopPropagation()
              setNewName(node.name)
              setRenaming(true)
            }}
            className="rounded p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
          >
            <Edit3 className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="删除"
            onClick={(e) => void handleDelete(e)}
            className="rounded p-0.5 opacity-60 hover:bg-red-500/15 hover:text-red-500 hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {node.isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              activeFilePath={activeFilePath}
              depth={depth + 1}
              onSelectFile={onSelectFile}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const Sidebar: React.FC<SidebarProps> = ({
  isDark,
  onSelectFile,
  onOpenFolder,
  onRefreshWorkspace,
  onJumpToHeading
}) => {
  const {
    preferences,
    updatePreferences,
    headings,
    workspaceDir,
    workspaceTree,
    workspaceQuery,
    workspaceResults,
    setWorkspaceSearch,
    getActiveTab
  } = useEditorStore()

  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(null)
  const [creatingName, setCreatingName] = useState('')

  const activeTab = getActiveTab()
  const width = preferences.sidebarWidth || 300
  const activePanel: SidebarPanel = preferences.sidebarTab

  useEffect(() => {
    if (!workspaceDir || !workspaceQuery.trim() || !window.sable) {
      if (workspaceResults.length > 0) {
        setWorkspaceSearch(workspaceQuery, [])
      }
      return
    }
    const timer = setTimeout(() => {
      void window.sable.searchWorkspace(workspaceDir, workspaceQuery).then((res) => {
        setWorkspaceSearch(workspaceQuery, res)
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [workspaceDir, workspaceQuery])

  const startResize = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width

    const onMove = (ev: MouseEvent): void => {
      const next = Math.min(560, Math.max(220, startW + (ev.clientX - startX)))
      updatePreferences({ sidebarWidth: next })
    }

    const onUp = (): void => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleCreateEntry = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!workspaceDir || !creatingType || !creatingName.trim() || !window.sable) {
      setCreatingType(null)
      return
    }
    const createdPath = await window.sable.createEntry(
      workspaceDir,
      creatingName.trim(),
      creatingType === 'folder'
    )
    const wasFile = creatingType === 'file'
    setCreatingType(null)
    setCreatingName('')
    onRefreshWorkspace()
    if (wasFile && createdPath) {
      onSelectFile(createdPath)
    }
  }

  const folderTitle = workspaceDir ? workspaceDir.split(/[\\/]/).pop() || workspaceDir : ''
  const minHeadingLevel =
    headings.length > 0 ? Math.min(...headings.map((h) => h.level)) : 1

  return (
    <aside
      style={{ width: `${width}px`, fontSize: 'var(--sable-ui-font-size, 14.5px)' }}
      className={`relative flex shrink-0 flex-col border-r select-none ${
        isDark
          ? 'border-neutral-800 bg-[#14161a] text-neutral-300'
          : 'border-neutral-200/90 bg-[#f7f7f8] text-neutral-700'
      }`}
    >
      <div
        className={`flex h-[2.6em] items-center border-b px-2 text-[0.94em] font-medium ${
          isDark ? 'border-neutral-800' : 'border-neutral-200/80'
        }`}
      >
        <button
          type="button"
          onClick={() => updatePreferences({ sidebarTab: 'outline' })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 transition ${
            activePanel === 'outline'
              ? isDark
                ? 'bg-neutral-800 text-white'
                : 'bg-white text-neutral-900 shadow-2xs'
              : 'opacity-65 hover:opacity-100'
          }`}
        >
          <ListTree className="h-4 w-4" />
          <span>大纲</span>
        </button>
        <button
          type="button"
          onClick={() => updatePreferences({ sidebarTab: 'files' })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 transition ${
            activePanel === 'files'
              ? isDark
                ? 'bg-neutral-800 text-white'
                : 'bg-white text-neutral-900 shadow-2xs'
              : 'opacity-65 hover:opacity-100'
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          <span>文件</span>
        </button>
      </div>

      {activePanel === 'outline' ? (
        <div className="flex-1 overflow-y-auto py-2.5">
          {headings.length === 0 ? (
            <div className="px-4 py-8 text-center text-[0.9em] opacity-50">
              当前文档暂无标题大纲
            </div>
          ) : (
            headings.map((h, index) => {
              const relDepth = h.level - minHeadingLevel
              const sizeScale =
                h.level === 1 ? '1.02em' : h.level === 2 ? '0.96em' : '0.91em'
              return (
                <button
                  key={`${h.pos}-${index}`}
                  type="button"
                  title={h.text}
                  onClick={() => onJumpToHeading(h.pos)}
                  style={{
                    paddingLeft: `${16 + relDepth * 16}px`,
                    fontSize: sizeScale
                  }}
                  className={`block w-full truncate py-1.5 pr-3.5 text-left leading-snug transition hover:bg-black/5 dark:hover:bg-white/5 ${
                    h.level === 1
                      ? 'font-semibold'
                      : h.level === 2
                        ? 'font-medium opacity-92'
                        : 'opacity-80'
                  }`}
                >
                  {h.text}
                </button>
              )
            })
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {!workspaceDir ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-xs opacity-60">打开本地文件夹以浏览和检索 Markdown 笔记</p>
              <button
                type="button"
                onClick={onOpenFolder}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  isDark
                    ? 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
                    : 'bg-neutral-900 text-white hover:bg-neutral-700'
                }`}
              >
                打开文件夹...
              </button>
            </div>
          ) : (
            <>
              <div
                className={`flex items-center justify-between border-b px-3 py-1.5 text-xs ${
                  isDark ? 'border-neutral-800' : 'border-neutral-200/70'
                }`}
              >
                <span className="truncate font-semibold" title={workspaceDir}>
                  {folderTitle}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="新建 Markdown 文档"
                    onClick={() => {
                      setCreatingType('file')
                      setCreatingName('')
                    }}
                    className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                  >
                    <FilePlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="新建子文件夹"
                    onClick={() => {
                      setCreatingType('folder')
                      setCreatingName('')
                    }}
                    className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="刷新目录"
                    onClick={onRefreshWorkspace}
                    className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="切换文件夹"
                    onClick={onOpenFolder}
                    className="rounded p-1 opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="px-2.5 py-1.5">
                <div
                  className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                    isDark
                      ? 'border-neutral-700/80 bg-neutral-900/70'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <Search className="h-3 w-3 opacity-50" />
                  <input
                    type="text"
                    value={workspaceQuery}
                    onChange={(e) => setWorkspaceSearch(e.target.value, workspaceResults)}
                    placeholder="搜索文件名或全文..."
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                </div>
              </div>

              {creatingType && (
                <form onSubmit={(e) => void handleCreateEntry(e)} className="px-2.5 pb-1.5">
                  <input
                    type="text"
                    value={creatingName}
                    onChange={(e) => setCreatingName(e.target.value)}
                    autoFocus
                    onBlur={() => setCreatingType(null)}
                    placeholder={creatingType === 'file' ? '输入新文档名称.md' : '输入新文件夹名称'}
                    className="w-full rounded border border-blue-500 bg-transparent px-2 py-1 text-xs outline-none"
                  />
                </form>
              )}

              <div className="flex-1 overflow-y-auto pb-4">
                {workspaceQuery.trim() ? (
                  workspaceResults.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs opacity-50">未找到匹配内容</div>
                  ) : (
                    workspaceResults.map((hit, idx) => (
                      <button
                        key={`${hit.filePath}-${hit.line}-${idx}`}
                        type="button"
                        onClick={() => onSelectFile(hit.filePath)}
                        className="block w-full border-b border-black/5 px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:border-white/5 dark:hover:bg-white/5"
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span className="truncate">{hit.fileName}</span>
                          <span className="text-[10px] opacity-50">L{hit.line}</span>
                        </div>
                        <div className="truncate text-[11px] opacity-65">{hit.preview}</div>
                      </button>
                    ))
                  )
                ) : workspaceTree.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs opacity-50">文件夹内暂无文档</div>
                ) : (
                  workspaceTree.map((node) => (
                    <TreeItem
                      key={node.path}
                      node={node}
                      activeFilePath={activeTab.filePath}
                      depth={0}
                      onSelectFile={onSelectFile}
                      onRefresh={onRefreshWorkspace}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div
        onMouseDown={startResize}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-blue-500/40"
      />
    </aside>
  )
}
