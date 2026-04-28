import { FolderPlus, FilePlus2, RefreshCw, ChevronRight, ChevronDown, File, Folder, Image as ImageIcon, FileCode2, Pencil, Trash2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { SidebarSectionAction, SidebarSectionConfig, View } from '@/config/layout'
import Spinner from './ui/Spinner'
import type { WorkspaceDeleteState, WorkspaceInlineCreateState, WorkspaceRenameState } from '@/hooks/useAppLayoutState'

export interface SidebarItem {
  id: string
  label: string
  description: string
  badge?: string
  badgeTone?: 'default' | 'success' | 'warning' | 'danger'
  group?: 'managed' | 'unmanaged'
}

export interface SidebarTreeItem {
  id: string
  label: string
  description: string
  depth: number
  kind: 'file' | 'directory'
  expanded?: boolean
  isBranch?: boolean
  icon?: 'file' | 'text' | 'image' | 'folder'
}

interface LeftSidebarProps {
  activeView: View
  width: number
  items: SidebarItem[]
  treeItems?: SidebarTreeItem[]
  section: SidebarSectionConfig
  footer?: ReactNode
  selectedItemId?: string | null
  workspaceInlineCreate: WorkspaceInlineCreateState
  workspaceRenameState: WorkspaceRenameState
  workspaceDeleteState: WorkspaceDeleteState
  workspaceRecentMutation?: { path: string | null; kind: 'create' | 'rename' | null; timestamp: number | null }
  workspaceRefreshPending: boolean
  workspaceRefreshError: string | null
  onSelectItem: (itemId: string) => void
  onAction?: (actionId: string) => void
  onToggleTreeItem?: (itemId: string) => void
  onWorkspaceInlineCreateChange: (value: string) => void
  onWorkspaceInlineCreateSubmit: () => void
  onWorkspaceInlineCreateCancel: () => void
  onWorkspaceRenameChange: (value: string) => void
  onWorkspaceRenameSubmit: () => void
  onWorkspaceRenameCancel: () => void
}

const ACTION_ICONS: Record<NonNullable<SidebarSectionAction['icon']>, typeof Plus> = {
  add: Plus,
  'add-file': FilePlus2,
  'add-folder': FolderPlus,
  refresh: RefreshCw,
  rename: Pencil,
  delete: Trash2,
}

const BADGE_TONES: Record<NonNullable<SidebarItem['badgeTone']>, string> = {
  default: 'text-[var(--color-text-secondary)] bg-[var(--color-bg)] border-[var(--color-border)]',
  success: 'text-[#4EC9B0] bg-[#4EC9B0]/10 border-[#4EC9B0]/30',
  warning: 'text-[#D7BA7D] bg-[#D7BA7D]/10 border-[#D7BA7D]/30',
  danger: 'text-[#F48771] bg-[#F48771]/10 border-[#F48771]/30',
}

const TREE_ICON_MAP = {
  file: File,
  text: FileCode2,
  image: ImageIcon,
  folder: Folder,
} as const

function WorkspaceContextMenu({
  x,
  y,
  itemKind,
  onAction,
}: {
  x: number
  y: number
  itemKind: 'file' | 'directory'
  onAction: (actionId: string) => void
}) {
  const maxWidth = 150
  const menuX = Math.min(x, Math.max(12, window.innerWidth - maxWidth - 12))
  const menuY = Math.min(y, Math.max(12, window.innerHeight - 220))

  const items = [
    { id: 'new-file', label: '新建文件', hidden: itemKind === 'file' },
    { id: 'new-folder', label: '新建文件夹', hidden: itemKind === 'file' },
    { id: 'rename-workspace-entry', label: '重命名' },
    { id: 'delete-workspace-entry', label: '删除' },
    { id: 'refresh-workspace', label: '刷新' },
  ].filter((item) => !item.hidden)

  return (
    <div
      className="fixed z-50 min-w-[150px] rounded border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl py-1"
      style={{ left: menuX, top: menuY }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onAction(item.id)
          }}
          className="w-full px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)]"
          role="menuitem"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
function shouldIgnoreEnterForIme(event: KeyboardEvent<HTMLInputElement>) {
  return event.nativeEvent.isComposing
}

export function LeftSidebar({
  activeView,
  width,
  items,
  treeItems,
  section,
  footer,
  selectedItemId,
  workspaceInlineCreate,
  workspaceRenameState,
  workspaceDeleteState,
  workspaceRecentMutation,
  workspaceRefreshPending,
  workspaceRefreshError,
  onSelectItem,
  onAction,
  onToggleTreeItem,
  onWorkspaceInlineCreateChange,
  onWorkspaceInlineCreateSubmit,
  onWorkspaceInlineCreateCancel,
  onWorkspaceRenameChange,
  onWorkspaceRenameSubmit,
  onWorkspaceRenameCancel,
}: LeftSidebarProps) {
  const shouldRenderTree = activeView === 'workspace' && treeItems
  const shouldRenderGroupedList = activeView === 'accounts'
  const [collapsedGroups, setCollapsedGroups] = useState<Record<'managed' | 'unmanaged', boolean>>({
    managed: false,
    unmanaged: false,
  })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string; itemKind: 'file' | 'directory' } | null>(null)

  const workspaceInlineCreateDepth = useMemo(() => {
    if (!workspaceInlineCreate.active || !workspaceInlineCreate.parentPath || !treeItems) {
      return 0
    }

    const parentItem = treeItems.find((item) => item.id === workspaceInlineCreate.parentPath)
    if (!parentItem) {
      return 0
    }

    return parentItem.depth + 1
  }, [treeItems, workspaceInlineCreate.active, workspaceInlineCreate.parentPath])

  const treeItemIds = useMemo(() => new Set((treeItems ?? []).map((item) => item.id)), [treeItems])

  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('click', handleWindowClick)
    window.addEventListener('keydown', handleEscape as unknown as EventListener)

    return () => {
      window.removeEventListener('click', handleWindowClick)
      window.removeEventListener('keydown', handleEscape as unknown as EventListener)
    }
  }, [])

  const renderInlineCreateRow = (depth: number) => {
    if (!workspaceInlineCreate.active) return null

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (shouldIgnoreEnterForIme(event)) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        void onWorkspaceInlineCreateSubmit()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onWorkspaceInlineCreateCancel()
      }
    }

    return (
      <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2" style={{ marginLeft: `${depth * 14}px` }}>
        <div className="flex items-center gap-2">
          {workspaceInlineCreate.kind === 'folder' ? (
            <Folder className="w-4 h-4 text-[#D7BA7D] flex-shrink-0" />
          ) : (
            <File className="w-4 h-4 text-[#4EC9B0] flex-shrink-0" />
          )}
          <input
            autoFocus
            value={workspaceInlineCreate.value}
            disabled={workspaceInlineCreate.pending}
            onChange={(event) => onWorkspaceInlineCreateChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!workspaceInlineCreate.pending) {
                onWorkspaceInlineCreateCancel()
              }
            }}
            placeholder={workspaceInlineCreate.kind === 'folder' ? '输入新文件夹名称' : '输入新文件名称'}
            className="flex-1 h-8 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[#007ACC]"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-h-[16px] text-[11px] text-[#F48771]">
            {workspaceInlineCreate.error ?? ''}
          </div>
          <div className="flex items-center gap-2">
            {workspaceInlineCreate.pending && <Spinner size="sm" className="border-[var(--color-border)] border-t-[#007ACC]" />}
            <button
              type="button"
              disabled={workspaceInlineCreate.pending}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onWorkspaceInlineCreateCancel()}
              className="h-7 px-2 rounded text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={workspaceInlineCreate.pending}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void onWorkspaceInlineCreateSubmit()}
              className="h-7 px-2 rounded text-xs bg-[#0E639C] text-white hover:bg-[#1177bb] disabled:opacity-50"
            >
              {workspaceInlineCreate.pending ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderRenameRow = (depth: number) => {
    if (!workspaceRenameState.active) return null

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (shouldIgnoreEnterForIme(event)) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        void onWorkspaceRenameSubmit()
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        onWorkspaceRenameCancel()
      }
    }

    return (
      <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-2" style={{ marginLeft: `${depth * 14}px` }}>
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-[#9CDCFE] flex-shrink-0" />
          <input
            autoFocus
            value={workspaceRenameState.value}
            disabled={workspaceRenameState.pending}
            onChange={(event) => onWorkspaceRenameChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!workspaceRenameState.pending) {
                onWorkspaceRenameCancel()
              }
            }}
            placeholder="输入新名称"
            className="flex-1 h-8 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)] outline-none focus:border-[#007ACC]"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-h-[16px] text-[11px] text-[#F48771]">
            {workspaceRenameState.error ?? ''}
          </div>
          <div className="flex items-center gap-2">
            {workspaceRenameState.pending && <Spinner size="sm" className="border-[var(--color-border)] border-t-[#007ACC]" />}
            <button
              type="button"
              disabled={workspaceRenameState.pending}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onWorkspaceRenameCancel()}
              className="h-7 px-2 rounded text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={workspaceRenameState.pending}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void onWorkspaceRenameSubmit()}
              className="h-7 px-2 rounded text-xs bg-[#0E639C] text-white hover:bg-[#1177bb] disabled:opacity-50"
            >
              {workspaceRenameState.pending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderWorkspaceTreeItem = (item: SidebarTreeItem) => {
    const isSelected = selectedItemId === item.id
    const Icon = TREE_ICON_MAP[item.icon ?? (item.kind === 'directory' ? 'folder' : 'file')]
    const ChevronIcon = item.expanded ? ChevronDown : ChevronRight
    const shouldShowInlineCreate = workspaceInlineCreate.active && workspaceInlineCreate.parentPath === item.id && item.kind === 'directory' && item.expanded
    const isRenameTarget = workspaceRenameState.active && workspaceRenameState.path === item.id
    const isContextMenuOpen = contextMenu?.itemId === item.id
    const isRecentlyMutated = workspaceRecentMutation?.path === item.id && workspaceRecentMutation.timestamp != null && Date.now() - workspaceRecentMutation.timestamp < 4000

    const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      onSelectItem(item.id)
      setContextMenu({ x: event.clientX, y: event.clientY, itemId: item.id, itemKind: item.kind })
    }

    return (
      <div key={item.id} className="group space-y-1">
        <button
          type="button"
          onClick={() => onSelectItem(item.id)}
          onContextMenu={handleContextMenu}
          className={[
            'w-full text-left rounded-md border transition-colors pr-2',
            isSelected || isContextMenuOpen
              ? 'border-[#094771] bg-[#062F4A] text-[#FFFFFF] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]'
              : isRecentlyMutated
                ? 'border-[#0E639C] bg-[#0E639C]/15 text-[var(--color-text)]'
                : 'border-transparent text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] hover:border-[var(--color-border)]',
          ].join(' ')}
          style={{ paddingLeft: `${8 + item.depth * 14}px`, paddingTop: '6px', paddingBottom: '6px' }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              onClick={(event) => {
                event.stopPropagation()
                if (item.isBranch) {
                  onToggleTreeItem?.(item.id)
                }
              }}
              className={[
                'h-4 w-4 flex items-center justify-center rounded cursor-pointer',
                item.isBranch ? 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]' : 'text-transparent pointer-events-none',
              ].join(' ')}
              role="button"
              tabIndex={-1}
              aria-label={item.expanded ? '折叠文件夹' : '展开文件夹'}
            >
              <ChevronIcon className="w-3.5 h-3.5" />
            </span>
            <Icon className={[
              'w-4 h-4 flex-shrink-0',
              item.kind === 'directory' ? 'text-[#D7BA7D]' : item.icon === 'image' ? 'text-[#9CDCFE]' : 'text-[#4EC9B0]',
            ].join(' ')} />
            <span className="text-sm truncate">{item.label}</span>
          </div>
        </button>
        {isRenameTarget ? renderRenameRow(item.depth) : null}
        {shouldShowInlineCreate ? renderInlineCreateRow(item.depth + 1) : null}
      </div>
    )
  }

  return (
    <aside
      className="bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0 min-w-0"
      style={{ width }}
      data-view={activeView}
    >
      <div className="px-3 pt-3 pb-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] tracking-[0.08em] text-[var(--color-text)] font-semibold truncate">{section.title}</div>

          {section.actions && section.actions.length > 0 && (
            <div className="flex items-center gap-0.5">
              {section.actions.map((action) => {
                const Icon = action.icon ? ACTION_ICONS[action.icon] : Plus
                const isRefreshAction = action.id === 'refresh-workspace'
                const isCreateAction = action.id === 'new-file' || action.id === 'new-folder'
                const isRenameAction = action.id === 'rename-workspace-entry'
                const isDeleteAction = action.id === 'delete-workspace-entry'
                const disabled = isRefreshAction
                  ? workspaceRefreshPending
                  : isCreateAction
                    ? workspaceInlineCreate.pending || workspaceRenameState.pending || workspaceDeleteState.pending
                    : isRenameAction
                      ? workspaceRenameState.pending || workspaceDeleteState.pending
                      : isDeleteAction
                        ? workspaceDeleteState.pending || workspaceRenameState.pending
                        : false

                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      onAction?.(action.id)
                      setContextMenu(null)
                    }}
                    disabled={disabled}
                    className="h-7 w-7 flex items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
                    aria-label={action.label}
                    title={action.label}
                  >
                    {isRefreshAction && workspaceRefreshPending ? (
                      <Spinner size="sm" className="border-[var(--color-border)] border-t-[#007ACC]" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-[var(--color-text-secondary)] mt-2 leading-5 pr-1">{section.description}</p>
        {activeView === 'workspace' && workspaceRefreshError ? (
          <p className="mt-2 text-[11px] text-[#F48771] leading-5">{workspaceRefreshError}</p>
        ) : null}
        {activeView === 'workspace' && workspaceRefreshPending ? (
          <p className="mt-2 text-[11px] text-[var(--color-text-secondary)] leading-5">正在刷新工作区...</p>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {shouldRenderTree ? (
          treeItems.length === 0 ? (
            <div className="space-y-2">
              {workspaceInlineCreate.active ? renderInlineCreateRow(0) : null}
              <div className="px-2 py-3 text-xs text-[var(--color-text-secondary)] leading-5">{section.emptyMessage}</div>
            </div>
          ) : (
            <div className="space-y-1">
              {workspaceInlineCreate.active && (!workspaceInlineCreate.parentPath || !treeItemIds.has(workspaceInlineCreate.parentPath))
                ? renderInlineCreateRow(workspaceInlineCreateDepth)
                : null}
              {treeItems.map((item) => renderWorkspaceTreeItem(item))}
            </div>
          )
        ) : items.length === 0 ? (
          <div className="px-2 py-3 text-xs text-[var(--color-text-secondary)] leading-5">{section.emptyMessage}</div>
        ) : shouldRenderGroupedList ? (
          <div className="space-y-3">
            {(['managed', 'unmanaged'] as const)
              .filter((group) => items.some((item) => (item.group ?? 'managed') === group))
              .map((group) => {
                const groupItems = items.filter((item) => (item.group ?? 'managed') === group)
                const groupLabel = group === 'managed' ? '当前已管理账号' : '未管理在线账号'

                return (
                  <div key={group} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                      className="w-full px-2.5 flex items-center justify-between text-[11px] font-semibold tracking-[0.06em] text-[var(--color-text-secondary)] cursor-pointer"
                    >
                      <span>{groupLabel}</span>
                      {collapsedGroups[group] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {!collapsedGroups[group] && (
                      <div className="space-y-0.5">
                        {groupItems.map((item) => {
                          const isSelected = selectedItemId === item.id

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => onSelectItem(item.id)}
                              className={[
                                'w-full text-left px-2.5 py-2 rounded-md border transition-colors',
                                isSelected
                                  ? 'border-[#094771] bg-[#062F4A] text-[#FFFFFF] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]'
                                  : 'border-transparent text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] hover:border-[var(--color-border)]',
                              ].join(' ')}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm truncate">{item.label}</div>
                                  <div className={['text-[11px] truncate mt-0.5', isSelected ? 'text-[#9CDCFE]' : 'text-[var(--color-text-secondary)]'].join(' ')}>
                                    {item.description}
                                  </div>
                                </div>
                                {item.badge && (
                                  <span
                                    className={[
                                      'text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap mt-0.5',
                                      BADGE_TONES[item.badgeTone ?? 'default'],
                                    ].join(' ')}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        ) : (
          <div className="space-y-0.5">
            {items.map((item) => {
              const isSelected = selectedItemId === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  className={[
                    'w-full text-left px-2.5 py-2 rounded-md border transition-colors',
                    isSelected
                      ? 'border-[#094771] bg-[#062F4A] text-[#FFFFFF] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]'
                      : 'border-transparent text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] hover:border-[var(--color-border)]',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{item.label}</div>
                      <div className={['text-[11px] truncate mt-0.5', isSelected ? 'text-[#9CDCFE]' : 'text-[var(--color-text-secondary)]'].join(' ')}>
                        {item.description}
                      </div>
                    </div>
                    {item.badge && (
                      <span
                        className={[
                          'text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap mt-0.5',
                          BADGE_TONES[item.badgeTone ?? 'default'],
                        ].join(' ')}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {contextMenu && activeView === 'workspace' ? (
        <WorkspaceContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          itemKind={contextMenu.itemKind}
          onAction={(actionId) => {
            onAction?.(actionId)
            setContextMenu(null)
          }}
        />
      ) : null}

      {footer && <div className="border-t border-[var(--color-border)]">{footer}</div>}
    </aside>
  )
}
