import type { Task } from '@/services/task'

interface TaskCardProps {
  task: Task
  onViewDetail: () => void
  onEdit: () => void
  onExecute: () => void
  onPause: () => void
  onResume: () => void
  onDelete: () => void
}

// Extract script filename for display
const getScriptLabel = (scriptPath: string) => {
  const filename = scriptPath.split('/').pop() || scriptPath
  return filename.replace('.py', '')
}

const STATUS_LABELS: Record<Task['status'], string> = {
  idle: '待执行',
  running: '运行中',
  paused: '已暂停',
  completed: '已完成',
  failed: '执行失败',
}

export default function TaskCard({
  task,
  onViewDetail,
  onEdit,
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

  const scriptLabel = getScriptLabel(task.scriptPath)
  const statusLabel = STATUS_LABELS[task.status] || '未知状态'

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3 hover:border-[#6D5BF6] hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold mb-1">{task.name}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mb-2">{scriptLabel}</div>
          <div className="flex gap-1 flex-wrap">
            <span
              className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${
                task.type === 'scheduled'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-orange-50 text-orange-600'
              }`}
            >
              {task.type === 'scheduled' ? '定时任务' : '即时任务'}
            </span>
            <span
              className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${
                task.status === 'running'
                  ? 'bg-green-500/10 text-green-500'
                  : task.status === 'paused'
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : task.status === 'failed'
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-gray-500/10 text-gray-500'
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Meta Info */}
      <div className="space-y-1 mb-2 text-xs text-[var(--color-text-secondary)]">
        <div>执行账号：{task.accountScreenName ? `@${task.accountScreenName}` : '未指定'}</div>
        {task.tweetId && <div>目标推文：{task.tweetId}</div>}
        {task.text && <div className="line-clamp-2">文本：{task.text}</div>}
        {task.type === 'scheduled' ? (
          <>
            <div>执行规则：{task.schedule || '未配置'}</div>
            {task.nextExecutionTime && <div>下次执行：{formatRelativeTime(task.nextExecutionTime)}</div>}
            {task.lastExecutionTime ? (
              <div>最后执行：{formatRelativeTime(task.lastExecutionTime)}</div>
            ) : (
              <div>尚未执行</div>
            )}
            <div>成功率：{task.statistics?.successRate || 0}%</div>
          </>
        ) : (
          <>
            <div>描述：{task.description || '无'}</div>
            {task.lastExecutionTime ? (
              <div>
                最后执行：{formatRelativeTime(task.lastExecutionTime)}{' '}
                {task.lastExecutionStatus && (
                  <span
                    className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${
                      task.lastExecutionStatus === 'success'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {task.lastExecutionStatus === 'success' ? '成功' : '失败'}
                  </span>
                )}
              </div>
            ) : (
              <div>尚未执行</div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)] min-h-[32px]">
        <button
          onClick={onViewDetail}
          className="h-6 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors flex-shrink-0"
        >
          查看详情
        </button>
        <button
          onClick={onEdit}
          className="h-6 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors flex-shrink-0"
        >
          编辑
        </button>
        {task.type === 'immediate' ? (
          <button
            onClick={onExecute}
            disabled={task.status === 'running'}
            className="h-6 px-2 text-xs bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50 flex-shrink-0"
          >
            立即执行
          </button>
        ) : task.status === 'running' ? (
          <button
            onClick={onPause}
            className="h-6 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors flex-shrink-0"
          >
            暂停
          </button>
        ) : (
          <button
            onClick={onResume}
            className="h-6 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors flex-shrink-0"
          >
            恢复
          </button>
        )}
        <button
          onClick={onDelete}
          className="h-6 px-2 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex-shrink-0 ml-auto"
        >
          删除
        </button>
      </div>
    </div>
  )
}
