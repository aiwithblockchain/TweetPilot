import { useEffect, useMemo, useState } from 'react'
import { taskService } from '@/services'
import { TaskActionBar } from './TaskActionBar'
import { ScriptExecutionMonitor } from './ScriptExecutionMonitor'
import type { ExecutionResult, Task, TaskDetail } from '@/services/task'

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
      <div className="rounded-2xl border border-[#2A2A2A] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.22)] bg-[linear-gradient(135deg,#6D5BF622_0%,#252526_50%,#171718_100%)]">
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-[#CCCCCC]">
                任务详情
              </div>
              <h2 className="text-2xl font-semibold text-white mt-4">{task.name}</h2>
              <p className="text-sm text-[#D4D4D4] mt-2 leading-6 max-w-2xl">{task.description || '当前任务暂无详细描述。'}</p>
            </div>
            <div className={[
              'text-xs px-3 py-1.5 rounded-full border whitespace-nowrap',
              task.status === 'running'
                ? 'border-[#4EC9B0]/30 bg-[#4EC9B0]/12 text-[#4EC9B0]'
                : task.status === 'failed'
                  ? 'border-[#F48771]/30 bg-[#F48771]/12 text-[#F48771]'
                  : task.status === 'paused'
                    ? 'border-[#D7BA7D]/30 bg-[#D7BA7D]/12 text-[#D7BA7D]'
                    : 'border-white/10 bg-black/20 text-[#CCCCCC]',
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
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <div className="space-y-5">
          <SidePanel title="📊 执行统计">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="text-2xl font-semibold text-[#CCCCCC]">{detail.statistics.totalExecutions}</div>
                <div className="text-xs text-[#858585] mt-1">总次数</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-[#4EC9B0]">{detail.statistics.successCount}</div>
                <div className="text-xs text-[#858585] mt-1">成功</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-[#F48771]">{detail.statistics.failureCount}</div>
                <div className="text-xs text-[#858585] mt-1">失败</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-[#CCCCCC]">{detail.statistics.successRate}%</div>
                <div className="text-xs text-[#858585] mt-1">成功率</div>
              </div>
            </div>
            <div className="text-xs text-[#858585] mt-3 text-center">
              平均耗时: {detail.statistics.averageDuration}s
            </div>
          </SidePanel>

          <SidePanel title="📜 最近执行记录">
            {detail.history.length === 0 ? (
              <div className="text-sm text-[#858585]">还没有执行记录。</div>
            ) : (
              <>
                <div className="space-y-2">
                  {latestHistory.map((item, index) => (
                    <div
                      key={`${item.startTime}-${index}`}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#171718] border border-[#2A2A2A]"
                    >
                      <span className="text-[#858585]">
                        {item.status === 'success' ? '✓' : '✗'} {formatDateTime(item.startTime).split(' ')[1]}
                      </span>
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
                  <span className="text-[#858585]">状态</span>
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
                  <span className="text-[#858585]">时间</span>
                  <span className="text-[#CCCCCC]">{formatDateTime(task.lastExecution.startTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#858585]">耗时</span>
                  <span className="text-[#CCCCCC]">{task.lastExecution.duration.toFixed(2)}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#858585]">退出码</span>
                  <span className="text-[#CCCCCC]">{task.lastExecution.exitCode}</span>
                </div>
                {task.lastExecution.output && (
                  <div className="pt-2">
                    <button
                      onClick={() => setOutputExpanded(!outputExpanded)}
                      className="text-[#858585] hover:text-[#CCCCCC] flex items-center gap-1 text-xs"
                    >
                      输出 {outputExpanded ? '▼' : '▶'}
                    </button>
                    {outputExpanded && (
                      <pre className="text-xs bg-[#171718] border border-[#2A2A2A] p-3 rounded-lg mt-2 overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
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
                        className="text-[10px] px-2 py-1 rounded bg-[#5A1D1D] text-[#F48771] hover:bg-[#6A2D2D] transition-colors"
                        title="复制错误信息"
                      >
                        复制
                      </button>
                    </div>
                    <pre className="error-output text-xs bg-[#3A1F1F] border border-[#5A1D1D] text-[#F48771] p-3 rounded-lg whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
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
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 shadow-inner">
      <div className="text-[11px] text-[#B8B8B8]">{label}</div>
      <div className="text-sm text-white mt-1 leading-6">{value}</div>
    </div>
  )
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#2A2A2A] bg-[#252526] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
      <div className="text-sm font-semibold text-[#CCCCCC] mb-3">{title}</div>
      {children}
    </section>
  )
}

function HistoryCard({ item }: { item: ExecutionResult }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#171718] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-[#CCCCCC]">{item.status === 'success' ? '执行成功' : '执行失败'}</div>
        <div className={['text-[11px]', item.status === 'success' ? 'text-[#4EC9B0]' : 'text-[#F48771]'].join(' ')}>
          {item.status === 'success' ? 'SUCCESS' : 'FAILURE'}
        </div>
      </div>
      <div className="text-[11px] text-[#858585] mt-2">开始：{formatDateTime(item.startTime)}</div>
      <div className="text-[11px] text-[#858585] mt-1">结束：{formatDateTime(item.endTime)}</div>
      <div className="text-[11px] text-[#858585] mt-1">耗时：{item.duration}s</div>
    </div>
  )
}

function CenteredMessage({ tone, message }: { tone: 'neutral' | 'error'; message: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div
        className={[
          'max-w-md text-center rounded border px-6 py-8 text-sm',
          tone === 'error'
            ? 'border-[#5A1D1D] bg-[#3A1F1F] text-[#F48771]'
            : 'border-[#2A2A2A] bg-[#252526] text-[#858585]',
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
  return date.toLocaleString('zh-CN')
}
