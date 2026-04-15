import { Task } from '../pages/TaskManagement'

interface TaskCardProps {
  task: Task
  onViewDetail: () => void
  onExecute: () => void
  onPause: () => void
  onResume: () => void
  onDelete: () => void
}

export default function TaskCard({
  task,
  onViewDetail,
  onExecute,
  onPause,
  onResume,
  onDelete,
}: TaskCardProps) {
  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins} 分钟前`
    if (diffHours < 24) return `${diffHours} 小时前`
    if (diffDays < 7) return `${diffDays} 天前`
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[#6D5BF6] hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="text-base font-semibold mb-1">{task.name}</div>
          <div className="flex gap-1">
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                task.type === 'scheduled'
                  ? 'bg-blue-500/10 text-blue-500'
                  : 'bg-purple-500/10 text-purple-500'
              }`}
            >
              {task.type === 'scheduled' ? '定时任务' : '即时任务'}
            </span>
            <span
              className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
                task.status === 'running'
                  ? 'bg-green-500/10 text-green-500'
                  : task.status === 'paused'
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : 'bg-gray-500/10 text-gray-500'
              }`}
            >
              {task.status === 'running'
                ? '运行中'
                : task.status === 'paused'
                ? '已暂停'
                : '待执行'}
            </span>
          </div>
        </div>
      </div>

      {/* Meta Info */}
      <div className="space-y-1 mb-3 text-xs text-[var(--color-text-secondary)]">
        {task.type === 'immediate' ? (
          <>
            <div>执行规则：</div>
            <div>尚未执行</div>
            <div>成功率：{task.statistics?.successRate || 0}%</div>
          </>
        ) : (
          <>
            <div>执行规则：{task.schedule || '0 * * * *'}</div>
            <div>尚未执行</div>
            <div>成功率：{task.statistics?.successRate || 0}%</div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onViewDetail}
          className="h-7 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors"
        >
          查看详情
        </button>
        {task.type === 'immediate' ? (
          <button
            onClick={onExecute}
            disabled={task.status === 'running'}
            className="h-7 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors disabled:opacity-50"
          >
            立即执行
          </button>
        ) : task.status === 'running' ? (
          <button
            onClick={onPause}
            className="h-7 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors"
          >
            暂停
          </button>
        ) : (
          <button
            onClick={onResume}
            className="h-7 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors"
          >
            恢复
          </button>
        )}
        <button
          onClick={onDelete}
          className="h-7 px-2 text-xs text-red-500 border border-red-500 rounded hover:bg-red-500/10 transition-colors"
        >
          删除
        </button>
      </div>
    </div>
  )
}
