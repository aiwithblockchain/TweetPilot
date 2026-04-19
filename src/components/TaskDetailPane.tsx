import { TaskCreatePane } from './TaskCreatePane'
import { TaskDetailContentPane } from './TaskDetailContentPane'
import type { SidebarItem } from '@/config/layout'

interface TaskDetailPaneProps {
  item: SidebarItem | null
  mode?: 'detail' | 'create'
  onCreated?: (taskId?: string) => void
}

export function TaskDetailPane({ item, mode = 'detail', onCreated }: TaskDetailPaneProps) {
  if (mode === 'create') {
    return <TaskCreatePane onCreated={onCreated} />
  }

  if (!item) {
    return <EmptyState title="任务" description="请先在左侧选择一个任务，或点击左上角 + 号新建任务。" />
  }

  return <TaskDetailContentPane taskId={item.id} />
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-md text-center rounded border border-[#2A2A2A] bg-[#252526] px-6 py-8">
        <div className="text-base font-semibold text-[#CCCCCC]">{title}</div>
        <p className="text-sm text-[#858585] mt-3 leading-6">{description}</p>
      </div>
    </div>
  )
}
