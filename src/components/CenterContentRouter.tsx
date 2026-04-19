import { AccountDetailPane } from './AccountDetailPane'
import { DataBlockDetailPane } from './DataBlockDetailPane'
import { TaskDetailPane } from './TaskDetailPane'
import { WorkspaceDetailPane } from './WorkspaceDetailPane'
import type { SidebarItem, View } from '@/config/layout'
import type { WorkspaceFileContent, WorkspaceFolderSummary } from '@/services/workspace'
import type { AppInstance } from '@/types/layout'

interface CenterContentRouterProps {
  activeView: View
  selectedSidebarItem: SidebarItem | null
  centerMode: 'empty' | 'detail' | 'create-task'
  instances: AppInstance[]
  workspaceFileContent?: WorkspaceFileContent | null
  workspaceFolderSummary?: WorkspaceFolderSummary | null
  workspaceLoading?: boolean
  workspaceError?: string | null
  onTaskCreated?: (taskId?: string) => void
}

export function CenterContentRouter({
  activeView,
  selectedSidebarItem,
  centerMode,
  instances,
  workspaceFileContent,
  workspaceFolderSummary,
  workspaceLoading,
  workspaceError,
  onTaskCreated,
}: CenterContentRouterProps) {
  if (centerMode === 'create-task') {
    return <TaskDetailPane item={selectedSidebarItem} mode="create" onCreated={onTaskCreated} />
  }

  if (!selectedSidebarItem) {
    return <CenterEmptyState view={activeView} />
  }

  switch (activeView) {
    case 'accounts':
      return <AccountDetailPane item={selectedSidebarItem} instances={instances} />
    case 'data-blocks':
      return <DataBlockDetailPane item={selectedSidebarItem} />
    case 'tasks':
      return <TaskDetailPane item={selectedSidebarItem} />
    case 'workspace':
    default:
      return (
        <WorkspaceDetailPane
          item={selectedSidebarItem}
          fileContent={workspaceFileContent}
          folderSummary={workspaceFolderSummary}
          loading={workspaceLoading}
          error={workspaceError}
        />
      )
  }
}

function CenterEmptyState({ view }: { view: View }) {
  const copy: Record<View, { title: string; description: string }> = {
    workspace: {
      title: '工作区',
      description: '左侧显示目录树和基础操作，中间只在你选择文件或文件夹之后展示内容。',
    },
    accounts: {
      title: '推特账号',
      description: '左侧显示推特账号列表，中间展示选中账号及其关联实例信息。',
    },
    'data-blocks': {
      title: '数据积木',
      description: '左侧维护数据积木列表，中间展示积木详情。点击左上角 + 号可新增。',
    },
    tasks: {
      title: '任务',
      description: '左侧显示任务列表，中间展示任务详情。新增任务会在中间主区打开。',
    },
  }

  const current = copy[view]

  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-lg text-center rounded border border-[#2A2A2A] bg-[#252526] px-6 py-8">
        <div className="text-base font-semibold text-[#CCCCCC]">{current.title}</div>
        <p className="text-sm text-[#858585] mt-3 leading-6">{current.description}</p>
      </div>
    </div>
  )
}
