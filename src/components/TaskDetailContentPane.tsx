import { useEffect, useMemo, useState } from 'react'
import { taskService } from '@/services'
import { TaskActionBar } from './TaskActionBar'
import { ScriptExecutionMonitor } from './ScriptExecutionMonitor'
import type { Task, TaskDetail } from '@/services/task'

interface TaskDetailContentPaneProps {
  taskId: string
  onDeleted?: () => void
}

export function TaskDetailContentPane({ taskId, onDeleted }: TaskDetailContentPaneProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [outputExpanded, setOutputExpanded] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)

  const loadDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await taskService.getTaskDetail(taskId)
      setDetail(result)
    } catch (err) {
      console.error('Failed to load task detail:', err)
      setError(err instanceof Error ? err.message : '读取任务详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDetail()
  }, [taskId])

  const task = detail?.task
  const latestHistory = useMemo(() => {
    const history = detail?.history ?? []
    return showAllHistory ? history : history.slice(0, 5)
  }, [detail, showAllHistory])

  if (loading) {
    return <CenteredMessage tone="neutral" message="正在加载任务详情..." />
  }

  if (error || !task || !detail) {
    return <CenteredMessage tone="error" message={error ?? '任务详情不存在'} />
  }

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.22)]" style={{ background: `linear-gradient(135deg, #6D5BF626 0%, var(--color-surface) 48%, var(--color-bg) 100%)` }}>
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-1 text-[11px] text-[var(--color-text)]">
                任务详情
              </div>
              <h2 className="text-2xl font-semibold text-[var(--color-text)] mt-4">{task.name}</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2 leading-6 max-w-2xl">{task.description || '当前任务暂无详细描述。'}</p>
            </div>
            <div className={[
              'text-xs px-3 py-1.5 rounded-full border whitespace-nowrap',
              task.status === 'running'
                ? 'border-[#4EC9B0]/30 bg-[#4EC9B0]/12 text-[#4EC9B0]'
                : task.status === 'failed'
                  ? 'border-[#F48771]/30 bg-[#F48771]/12 text-[#F48771]'
                  : task.status === 'paused'
                    ? 'border-[#D7BA7D]/30 bg-[#D7BA7D]/12 text-[#D7BA7D]'
                    : 'border-[var(--color-border)] bg-[var(--color-input)] text-[var(--color-text)]',
            ].join(' ')}>
              {formatTaskStatus(task.status)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            <HeroStat label="任务类型" value={task.type === 'scheduled' ? '定时任务' : '即时任务'} />
            <HeroStat
              label={task.type === 'scheduled' ? '下次执行' : '最近执行'}
              value={
                task.type === 'scheduled'
                  ? (task.nextExecutionTime ? formatDateTime(task.nextExecutionTime) : '未安排')
                  : (task.lastExecutionTime ? formatDateTime(task.lastExecutionTime) : '从未执行')
              }
            />
            <HeroStat label="执行账号" value={task.accountScreenName || '未指定'} />
          </div>

          {task.type === 'scheduled' && (
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] px-4 py-3">
              <div className="text-[11px] text-[var(--color-text-secondary)] mb-2">定时配置</div>
              <div className="text-sm text-[var(--color-text)] space-y-1">
                <div>类型: {task.scheduleType === 'interval' ? '简单间隔' : 'Cron 表达式'}</div>
                {task.scheduleType === 'interval' && task.intervalSeconds && (
                  <div>间隔: {formatInterval(task.intervalSeconds)}</div>
                )}
                {task.scheduleType === 'cron' && task.schedule && (
                  <div className="font-mono text-xs">
                    表达式: {convertCronToLocalTime(task.schedule)}
                    <div className="text-[10px] text-[var(--color-text-secondary)] mt-1">(本地时间)</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <div className="space-y-5">
          <SidePanel title="📊 执行统计">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-2xl font-semibold text-[var(--color-text)]">{detail.statistics.totalExecutions}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">总次数</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-[#4EC9B0]">{detail.statistics.successCount}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">成功</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-[#F48771]">{detail.statistics.failureCount}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">失败</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-[var(--color-text)]">{detail.statistics.successRate}%</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">成功率</div>
              </div>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-3 text-center">
              平均耗时: {detail.statistics.averageDuration}s
            </div>
          </SidePanel>

          <SidePanel title="📜 最近执行记录">
            {detail.history.length === 0 ? (
              <div className="text-sm text-[var(--color-text-secondary)]">还没有执行记录。</div>
            ) : (
              <>
                <div className="space-y-2">
                  {latestHistory.map((item, index) => (
                    <div
                      key={`${item.startTime}-${index}`}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-[var(--color-input)] border border-[var(--color-border)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className={item.status === 'success' ? 'text-[#4EC9B0]' : 'text-[#F48771]'}>
                          {item.status === 'success' ? '✓' : '✗'}
                        </span>
                        <span className="text-[var(--color-text)]">
                          {formatDateTime(item.startTime)}
                        </span>
                      </div>
                      <span
                        className={[
                          'px-2 py-0.5 rounded',
                          item.status === 'success' ? 'bg-[#4EC9B0]/12 text-[#4EC9B0]' : 'bg-[#F48771]/12 text-[#F48771]',
                        ].join(' ')}
                      >
                        {item.duration.toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
                {detail.history.length > 5 && (
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="text-xs text-[#6D5BF6] hover:text-[#5B4AD4] mt-3 w-full text-center"
                  >
                    {showAllHistory ? '收起 ↑' : `查看全部 (${detail.history.length}条) →`}
                  </button>
                )}
              </>
            )}
          </SidePanel>
        </div>

        <div className="space-y-5">
          <TaskActionBar task={task} onChanged={() => void loadDetail()} onDeleted={onDeleted} />

          {task.lastExecution && (
            <SidePanel title="⏱ 最后执行">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">状态</span>
                  <span
                    className={[
                      'px-2 py-0.5 rounded',
                      task.lastExecution.status === 'success'
                        ? 'bg-[#4EC9B0]/12 text-[#4EC9B0]'
                        : 'bg-[#F48771]/12 text-[#F48771]',
                    ].join(' ')}
                  >
                    {task.lastExecution.status === 'success' ? '成功' : '失败'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">时间</span>
                  <span className="text-[var(--color-text)]">{formatDateTime(task.lastExecution.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">耗时</span>
                  <span className="text-[var(--color-text)]">{task.lastExecution.duration.toFixed(2)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">退出码</span>
                  <span className="text-[var(--color-text)]">{task.lastExecution.exitCode}</span>
                </div>
                {task.lastExecution.output && (
                  <div className="pt-2">
                    <button
                      onClick={() => setOutputExpanded(!outputExpanded)}
                      className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] flex items-center gap-1 text-xs"
                    >
                      输出 {outputExpanded ? '▼' : '▶'}
                    </button>
                    {outputExpanded && (
                      <pre className="text-xs bg-[var(--color-input)] border border-[var(--color-border)] p-3 rounded-lg mt-2 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {task.lastExecution.output}
                      </pre>
                    )}
                  </div>
                )}
                {task.lastExecution.error && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[#F48771] text-xs">错误信息</div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(task.lastExecution!.error!)
                          // Optional: show a toast notification
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-red-900/30 text-[#F48771] hover:bg-[#6A2D2D] transition-colors"
                        title="复制错误信息"
                      >
                        复制
                      </button>
                    </div>
                    <pre className="error-output text-xs bg-red-950/30 border border-red-800/50 text-[#F48771] p-3 rounded-lg whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {task.lastExecution.error}
                    </pre>
                  </div>
                )}
              </div>
            </SidePanel>
          )}

          {task.status === 'running' && (
            <ScriptExecutionMonitor
              output={task.lastExecution?.output || ''}
              error={task.lastExecution?.error || ''}
              status="running"
            />
          )}
        </div>
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] px-4 py-3 shadow-inner">
      <div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-sm text-[var(--color-text)] mt-1 leading-6">{value}</div>
    </div>
  )
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
      <div className="text-sm font-semibold text-[var(--color-text)] mb-3">{title}</div>
      {children}
    </section>
  )
}

function CenteredMessage({ tone, message }: { tone: 'neutral' | 'error'; message: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div
        className={[
          'max-w-md text-center rounded border px-6 py-8 text-sm',
          tone === 'error'
            ? 'border-red-800/50 bg-red-950/30 text-[#F48771]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
        ].join(' ')}
      >
        {message}
      </div>
    </div>
  )
}

function formatTaskStatus(status: Task['status']) {
  const map: Record<Task['status'], string> = {
    idle: '空闲',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败',
  }
  return map[status]
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时`
  return `${Math.floor(seconds / 86400)} 天`
}

function convertCronToLocalTime(cronExpr: string): string {
  // Backend stores cron in UTC, convert to local time for display
  const parts = cronExpr.split(' ')
  if (parts.length !== 6) return cronExpr

  const utcHour = parseInt(parts[2])
  if (isNaN(utcHour)) return cronExpr

  // Convert UTC to CST (UTC+8)
  const localHour = (utcHour + 8) % 24
  parts[2] = localHour.toString()

  return parts.join(' ')
}
