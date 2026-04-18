import { Suspense, type LazyExoticComponent } from 'react'
import { AccountsOverview } from './AccountsOverview'
import { WorkspaceHome } from './WorkspaceHome'
import type { SidebarItem, TabId } from '@/config/layout'
import type { AppInstance } from '@/types/layout'

interface CenterContentRouterProps {
  activeTab: TabId
  selectedSidebarItem: SidebarItem | null
  instances: AppInstance[]
  instancesError: string | null
  TaskManagementPage: LazyExoticComponent<() => JSX.Element>
  DataBlocksPage: LazyExoticComponent<() => JSX.Element>
  SettingsPage: LazyExoticComponent<() => JSX.Element>
}

export function CenterContentRouter({
  activeTab,
  selectedSidebarItem,
  instances,
  instancesError,
  TaskManagementPage,
  DataBlocksPage,
  SettingsPage,
}: CenterContentRouterProps) {
  if (activeTab === 'claude-chat') {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="max-w-md text-center text-sm text-[#858585]">
          Claude 对话被固定在右侧面板中，这里预留为未来的全宽工作模式。
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={<CenterLoadingState />}>
      {(() => {
        switch (activeTab) {
          case 'tasks':
            return <TaskManagementPage />
          case 'data-blocks':
            return <DataBlocksPage />
          case 'settings':
            return <SettingsPage />
          case 'accounts':
            return <AccountsOverview item={selectedSidebarItem} />
          case 'workspace':
          default:
            return <WorkspaceHome item={selectedSidebarItem} instances={instances} instancesError={instancesError} />
        }
      })()}
    </Suspense>
  )
}

function CenterLoadingState() {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="rounded border border-[#2A2A2A] bg-[#252526] px-4 py-3 text-sm text-[#858585]">
        正在加载页面...
      </div>
    </div>
  )
}
