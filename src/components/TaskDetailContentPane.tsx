import { useEffect, useMemo, useState } from 'react'
import { taskService } from '@/services'
import { TaskActionBar } from './TaskActionBar'
import { ScriptExecutionMonitor } from './ScriptExecutionMonitor'
import type { ExecutionResult, Task, TaskDetail } from '@/services/task'

interface TaskDetailContentPaneProps {
  taskId: string
}

export function TaskDetailContentPane({ taskId }: TaskDetailContentPaneProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const latestHistory = useMemo(() => detail?.history.slice(0, 5) ?? [], [detail])

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
            <HeroStat label="当前状态" value={formatTaskStatus(task.status)} />
            <HeroStat label="执行账号" value={task.accountScreenName || '未指定'} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <section className="rounded-xl border border-[#2A2A2A] bg-[#252526] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="text-sm font-semibold text-[#CCCCCC] mb-4">基础信息</div>
          <InfoGrid
            items={[
              { label: '脚本路径', value: task.scriptPath },
              { label: '调度规则', value: task.schedule || '即时执行' },
              { label: '目标 tweetId', value: task.tweetId || '未设置' },
              { label: '查询备注', value: task.query || '未设置' },
            ]}
          />

          {task.text && (
            <div className="mt-5 rounded-xl border border-[#2A2A2A] bg-[#171718] p-4 shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
              <div className="text-[11px] text-[#858585]">任务文本内容</div>
              <div className="text-sm text-[#CCCCCC] mt-2 leading-7 whitespace-pre-wrap">{task.text}</div>
            </div>
          )}
        </section>

        <div className="space-y-5">
          <TaskActionBar task={task} onChanged={() => void loadDetail()} />

          {task.lastExecution && (
            <ScriptExecutionMonitor
              output={task.lastExecution.output}
              error={task.lastExecution.error}
              status={task.status === 'running' ? 'running' : task.lastExecution.status === 'success' ? 'completed' : 'failed'}
            />
          )}

          <SidePanel title="执行统计">
            <InfoGrid
              items={[
                { label: '总执行次数', value: String(detail.statistics.totalExecutions) },
                { label: '成功次数', value: String(detail.statistics.successCount) },
                { label: '失败次数', value: String(detail.statistics.failureCount) },
                { label: '成功率', value: `${detail.statistics.successRate}%` },
              ]}
            />
          </SidePanel>

          {task.lastExecutionStatus === 'failure' && task.lastExecution?.error && (
            <SidePanel title="最近失败原因">
              <div className="rounded-xl border border-[#5A1D1D] bg-[#3A1F1F] p-3 text-sm text-[#F48771] leading-6">
                {task.lastExecution.error}
              </div>
            </SidePanel>
          )}

          <SidePanel title="最近执行记录">
            {latestHistory.length === 0 ? (
              <div className="text-sm text-[#858585]">还没有执行记录。</div>
            ) : (
              <div className="space-y-3">
                {latestHistory.map((item, index) => (
                  <HistoryCard key={`${item.startTime}-${index}`} item={item} />
                ))}
              </div>
            )}
          </SidePanel>
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

function InfoGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-[#2A2A2A] bg-[#171718] p-3">
          <div className="text-[11px] text-[#858585]">{item.label}</div>
          <div className="text-sm text-[#CCCCCC] mt-1 break-all leading-6">{item.value}</div>
        </div>
      ))}
    </div>
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
