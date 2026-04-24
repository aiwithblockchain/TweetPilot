import { Menu, X } from 'lucide-react'
import { LeftSidebar, type SidebarTreeItem } from './LeftSidebar'
import type { SidebarItem, SidebarSectionConfig, View } from '@/config/layout'
import type { WorkspaceDeleteState, WorkspaceInlineCreateState, WorkspaceRenameState } from '@/hooks/useAppLayoutState'

interface MobileSidebarDrawerProps {
  activeView: View
  items: SidebarItem[]
  treeItems?: SidebarTreeItem[]
  section: SidebarSectionConfig
  selectedItemId?: string | null
  mobileSidebarOpen: boolean
  workspaceInlineCreate: WorkspaceInlineCreateState
  workspaceRenameState: WorkspaceRenameState
  workspaceDeleteState: WorkspaceDeleteState
  workspaceRefreshPending: boolean
  workspaceRefreshError: string | null
  onAction?: (actionId: string) => void
  onClose: () => void
  onOpen: () => void
  onSelectItem: (itemId: string) => void
  onToggleTreeItem?: (itemId: string) => void
  onWorkspaceInlineCreateChange: (value: string) => void
  onWorkspaceInlineCreateSubmit: () => void
  onWorkspaceInlineCreateCancel: () => void
  onWorkspaceRenameChange: (value: string) => void
  onWorkspaceRenameSubmit: () => void
  onWorkspaceRenameCancel: () => void
}

export function MobileSidebarDrawer({
  activeView,
  items,
  treeItems,
  section,
  selectedItemId,
  mobileSidebarOpen,
  workspaceInlineCreate,
  workspaceRenameState,
  workspaceDeleteState,
  workspaceRefreshPending,
  workspaceRefreshError,
  onAction,
  onClose,
  onOpen,
  onSelectItem,
  onToggleTreeItem,
  onWorkspaceInlineCreateChange,
  onWorkspaceInlineCreateSubmit,
  onWorkspaceInlineCreateCancel,
  onWorkspaceRenameChange,
  onWorkspaceRenameSubmit,
  onWorkspaceRenameCancel,
}: MobileSidebarDrawerProps) {
  return (
    <>
      <button
        onClick={onOpen}
        className="h-7 w-7 flex items-center justify-center rounded text-[var(--color-text)] hover:bg-[var(--color-border)] transition-all duration-150 flex-shrink-0"
        aria-label="打开侧边栏"
      >
        <Menu className="w-4 h-4" />
      </button>

      <div
        className={[
          'fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-200',
          mobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={[
          'fixed inset-y-8 left-12 z-50 w-[280px] max-w-[calc(100vw-3rem)] bg-[var(--color-surface)] border-r border-[var(--color-border)] shadow-2xl md:hidden flex flex-col transition-transform duration-200 ease-out',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+3rem)] pointer-events-none',
        ].join(' ')}
      >
        <div className="h-9 px-3 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface)]">
          <span className="text-xs font-semibold text-[var(--color-text)]">侧边栏</span>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] transition-colors"
            aria-label="关闭侧边栏"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <LeftSidebar
          activeView={activeView}
          width={280}
          items={items}
          treeItems={treeItems}
          section={section}
          selectedItemId={selectedItemId}
          workspaceInlineCreate={workspaceInlineCreate}
          workspaceRenameState={workspaceRenameState}
          workspaceDeleteState={workspaceDeleteState}
          workspaceRefreshPending={workspaceRefreshPending}
          workspaceRefreshError={workspaceRefreshError}
          onAction={onAction}
          onSelectItem={onSelectItem}
          onToggleTreeItem={onToggleTreeItem}
          onWorkspaceInlineCreateChange={onWorkspaceInlineCreateChange}
          onWorkspaceInlineCreateSubmit={onWorkspaceInlineCreateSubmit}
          onWorkspaceInlineCreateCancel={onWorkspaceInlineCreateCancel}
          onWorkspaceRenameChange={onWorkspaceRenameChange}
          onWorkspaceRenameSubmit={onWorkspaceRenameSubmit}
          onWorkspaceRenameCancel={onWorkspaceRenameCancel}
        />
      </div>
    </>
  )
}
