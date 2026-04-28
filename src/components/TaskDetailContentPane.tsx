import { useEffect, useMemo, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { taskService } from '@/services'
import { TaskActionBar } from './TaskActionBar'
import { ScriptExecutionMonitor } from './ScriptExecutionMonitor'
import { TaskCreatePane } from './TaskCreatePane'
import { AssistantMessage } from './ChatInterface/AssistantMessage'
import ExecutionResultModal from './ExecutionResultModal'
import type { LoadedSession, StoredMessage } from '@/services/ai/tauri'
import type { Task, TaskDetail, ExecutionResult } from '@/services/task'
import type { AssistantTimelineItem, ChatMessage, PersistedToolCall, ToolCall } from './ChatInterface/types'
import { convertCronToLocalTime } from '@/lib/cron-utils'

interface TaskDetailContentPaneProps {
  taskId: string
  onDeleted?: () => void
  onEditStateChange?: (state: {
    taskId: string
    taskName: string
    isEditing: boolean
    hasUnsavedChanges: boolean
  }) => void
}

interface TaskChangedPayload {
  taskId: string
}

interface TaskExecutedPayload {
  taskId: string
  status: string
  finishedAt: string
}

export function TaskDetailContentPane({ taskId, onDeleted, onEditStateChange }: TaskDetailContentPaneProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [outputExpanded, setOutputExpanded] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<LoadedSession | null>(null)
  const [selectedExecution, setSelectedExecution] = useState<ExecutionResult | null>(null)

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

  const handleViewSession = async (execution: Pick<ExecutionResult, 'id'>) => {
    try {
      setSessionLoading(true)
      setSessionError(null)
      const detail = await taskService.getExecutionDetail(execution.id)
      if (!detail.session) {
        setSelectedSession(null)
        setSessionError('该执行记录没有关联的 AI 过程')
        return
      }
      setSelectedSession(detail.session)
    } catch (err) {
      console.error('Failed to load task execution detail:', err)
      setSessionError(err instanceof Error ? err.message : '读取任务执行过程失败')
      setSelectedSession(null)
    } finally {
      setSessionLoading(false)
    }
  }

  const handleCloseSession = () => {
    setSelectedSession(null)
    setSessionError(null)
    setSessionLoading(false)
  }

  useEffect(() => {
    void loadDetail()
  }, [taskId])

  useEffect(() => {
    if (!taskId) return

    let disposed = false
    const unlistenFns: Array<() => void> = []

    const bind = async () => {
      const messageIds = [
        'task-executed',
        'task-updated',
        'task-paused',
        'task-resumed',
        'task-deleted',
      ] as const

      for (const messageId of messageIds) {
        const unlisten = await listen<TaskChangedPayload | TaskExecutedPayload>(messageId, (event) => {
          const payload = event.payload
          if (!payload || payload.taskId !== taskId) {
            return
          }

          if (messageId === 'task-deleted') {
            onDeleted?.()
            return
          }

          void loadDetail()
        })

        if (disposed) {
          unlisten()
        } else {
          unlistenFns.push(unlisten)
        }
      }
    }

    void bind()

    return () => {
      disposed = true
      for (const fn of unlistenFns) {
        fn()
      }
    }
  }, [taskId, onDeleted])

  useEffect(() => {
    setIsEditing(false)
    setHasUnsavedChanges(false)
  }, [taskId])

  const task = detail?.task
  const latestHistory = useMemo(() => {
    const history = detail?.history ?? []
    return showAllHistory ? history : history.slice(0, 5)
  }, [detail, showAllHistory])

  useEffect(() => {
    if (!task) return

    onEditStateChange?.({
      taskId: task.id,
      taskName: task.name,
      isEditing,
      hasUnsavedChanges,
    })
  }, [task, isEditing, hasUnsavedChanges, onEditStateChange])

  if (loading) {
    return <CenteredMessage tone="neutral" message="正在加载任务详情..." />
  }

  if (error || !task || !detail) {
    return <CenteredMessage tone="error" message={error ?? '任务详情不存在'} />
  }

  if (isEditing) {
    return (
      <TaskCreatePane
        mode="edit"
        initialTask={task}
        onCreated={() => {
          setHasUnsavedChanges(false)
          setIsEditing(false)
          void loadDetail()
        }}
        onCancel={() => {
          setHasUnsavedChanges(false)
          setIsEditing(false)
        }}
        onDirtyChange={setHasUnsavedChanges}
      />
    )
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
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <h2 className="text-2xl font-semibold text-[var(--color-text)]">{task.name}</h2>
                <div className={[
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] whitespace-nowrap',
                  task.executionMode === 'ai_session'
                    ? 'border-[#6D5BF6]/35 bg-[#6D5BF6]/10 text-[#CFC9FF]'
                    : 'border-[#4EC9B0]/30 bg-[#4EC9B0]/10 text-[#4EC9B0]',
                ].join(' ')}>
                  {task.executionMode === 'ai_session' ? 'AI 任务' : 'Python 脚本任务'}
                </div>
              </div>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
            <HeroStat label="任务类型" value={task.type === 'scheduled' ? '定时任务' : '即时任务'} />
            <HeroStat label="执行模式" value={task.executionMode === 'ai_session' ? 'AI 任务' : 'Python 脚本任务'} />
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
                  {latestHistory.map((item, index) => {
                    const isScriptTask = task.executionMode === 'script'

                    return (
                      <div
                        key={item.id || `${item.startTime}-${index}`}
                        className={[
                          'flex items-center justify-between gap-3 text-xs p-2 rounded-lg bg-[var(--color-input)] border',
                          selectedExecution?.id === item.id
                            ? 'border-[#6D5BF6]/60 ring-1 ring-[#6D5BF6]/35'
                            : 'border-[var(--color-border)]',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-3 min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={getExecutionTone(item.status)}>
                              {getExecutionIcon(item.status)}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[var(--color-text)]">
                                {formatDateTime(item.startTime)}
                              </div>
                              <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                                {formatExecutionStatus(item.status)}
                                {item.sessionCode ? ` · ${item.sessionCode}` : ''}
                              </div>
                            </div>
                          </div>
                          <span
                            className={[
                              'px-2 py-0.5 rounded shrink-0',
                              getExecutionStatusBadge(item.status),
                            ].join(' ')}
                          >
                            {item.duration.toFixed(1)}s
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isScriptTask && (
                            <button
                              onClick={() => setSelectedExecution(item)}
                              className="px-2.5 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-input)] transition-colors cursor-pointer"
                            >
                              执行详情
                            </button>
                          )}
                          {item.taskSessionId && (
                            <button
                              onClick={() => void handleViewSession(item)}
                              className="px-2.5 py-1 rounded border border-[#6D5BF6]/40 bg-[#6D5BF6]/10 text-[#CFC9FF] hover:bg-[#6D5BF6]/18 transition-colors cursor-pointer"
                            >
                              查看过程
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {detail.history.length > 5 && (
                  <button
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="text-xs text-[#6D5BF6] hover:text-[#5B4AD4] mt-3 w-full text-center cursor-pointer"
                  >
                    {showAllHistory ? '收起 ↑' : `查看全部 (${detail.history.length}条) →`}
                  </button>
                )}
              </>
            )}
          </SidePanel>
        </div>

        <div className="space-y-5">
          <TaskActionBar
            task={task}
            onChanged={() => void loadDetail()}
            onDeleted={onDeleted}
            onEdit={() => {
              setIsEditing(true)
            }}
            onHistoryCleared={() => {
              setShowAllHistory(false)
              void loadDetail()
            }}
          />

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
      {selectedSession && (
        <TaskAiSessionModal session={selectedSession} onClose={handleCloseSession} />
      )}

      {selectedExecution && (
        <ExecutionResultModal
          result={selectedExecution}
          onClose={() => setSelectedExecution(null)}
        />
      )}

      {sessionLoading && (
        <TaskAiSessionLoadingModal />
      )}

      {sessionError && !selectedSession && !sessionLoading && (
        <TaskAiSessionErrorModal message={sessionError} onClose={() => setSessionError(null)} />
      )}
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

function formatExecutionStatus(status: 'pending' | 'running' | 'success' | 'failure') {
  const map: Record<'pending' | 'running' | 'success' | 'failure', string> = {
    pending: '等待中',
    running: '运行中',
    success: '成功',
    failure: '失败',
  }
  return map[status]
}

function getExecutionIcon(status: 'pending' | 'running' | 'success' | 'failure') {
  const map: Record<'pending' | 'running' | 'success' | 'failure', string> = {
    pending: '◌',
    running: '↻',
    success: '✓',
    failure: '✗',
  }
  return map[status]
}

function getExecutionTone(status: 'pending' | 'running' | 'success' | 'failure') {
  const map: Record<'pending' | 'running' | 'success' | 'failure', string> = {
    pending: 'text-[#D7BA7D]',
    running: 'text-[#569CD6]',
    success: 'text-[#4EC9B0]',
    failure: 'text-[#F48771]',
  }
  return map[status]
}

function getExecutionStatusBadge(status: 'pending' | 'running' | 'success' | 'failure') {
  const map: Record<'pending' | 'running' | 'success' | 'failure', string> = {
    pending: 'bg-[#D7BA7D]/12 text-[#D7BA7D]',
    running: 'bg-[#569CD6]/12 text-[#569CD6]',
    success: 'bg-[#4EC9B0]/12 text-[#4EC9B0]',
    failure: 'bg-[#F48771]/12 text-[#F48771]',
  }
  return map[status]
}

function fromPersistedToolCall(toolCall: PersistedToolCall): ToolCall {
  return {
    id: toolCall.id,
    tool: toolCall.tool,
    action: toolCall.action,
    input: toolCall.input ?? undefined,
    output: toolCall.output ?? undefined,
    status: toolCall.status === 'running'
      ? 'running'
      : toolCall.status === 'error' || toolCall.status === 'failed'
        ? 'error'
        : 'success',
    duration: toolCall.duration ?? undefined,
    startTime: toolCall.start_time,
    endTime: toolCall.end_time ?? undefined,
  }
}

function buildTimelineFromStoredMessage(message: StoredMessage): AssistantTimelineItem[] {
  const toolCalls = message.tool_calls?.map(fromPersistedToolCall) || []
  const toolCallMap = new Map(toolCalls.map((toolCall) => [toolCall.id, toolCall]))
  const persistedTimeline = message.timeline || []

  if (persistedTimeline.length > 0) {
    return persistedTimeline.flatMap((item): AssistantTimelineItem[] => {
      if (item.type === 'thinking') {
        return [{
          id: item.id,
          type: 'thinking',
          content: item.content,
          isComplete: item.is_complete ?? true,
          isActive: !(item.is_complete ?? true),
        }]
      }

      if (item.type === 'tool') {
        const toolCall = toolCallMap.get(item.tool_call_id)
        return toolCall
          ? [{
              id: item.id,
              type: 'tool',
              toolCall,
            }]
          : []
      }

      return [{
        id: item.id,
        type: 'text',
        content: item.content,
      }]
    })
  }

  const timeline: AssistantTimelineItem[] = []

  if (message.thinking) {
    timeline.push({
      id: `${message.id ?? 'assistant'}-thinking`,
      type: 'thinking',
      content: message.thinking,
      isComplete: message.thinking_complete ?? true,
      isActive: !(message.thinking_complete ?? true),
    })
  }

  if (toolCalls.length) {
    timeline.push(
      ...toolCalls.map((toolCall) => ({
        id: `${message.id ?? 'assistant'}-tool-${toolCall.id}`,
        type: 'tool' as const,
        toolCall,
      })),
    )
  }

  if (message.content) {
    timeline.push({
      id: `${message.id ?? 'assistant'}-text`,
      type: 'text',
      content: message.content,
    })
  }

  return timeline
}

function fromStoredMessage(message: StoredMessage, index: number): ChatMessage {
  return {
    id: message.id ?? `${message.role}-${message.timestamp}-${index}`,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    timestamp: message.timestamp,
    thinking: message.thinking ?? undefined,
    thinkingComplete: message.thinking_complete ?? undefined,
    toolCalls: message.tool_calls?.map(fromPersistedToolCall),
    status: message.status ?? undefined,
    timeline: message.role === 'assistant' ? buildTimelineFromStoredMessage(message) : undefined,
  }
}

function TaskAiSessionModal({ session, onClose }: { session: LoadedSession; onClose: () => void }) {
  const messages = session.messages.map(fromStoredMessage)

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-5xl max-h-[88vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)] truncate">{session.session.title}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              {session.session.id} · {messages.length} 条消息
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-sm text-[var(--color-text-secondary)]">此执行过程暂无消息。</div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  {message.role === 'user' ? '用户' : '助手'} · {formatMessageTime(message.timestamp)}
                </div>
                {message.role === 'assistant' ? (
                  <AssistantMessage message={message} />
                ) : (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] whitespace-pre-wrap">
                    {message.content}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function TaskAiSessionLoadingModal() {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-5 text-sm text-[var(--color-text)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        正在加载执行过程...
      </div>
    </div>
  )
}

function TaskAiSessionErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-lg rounded-xl border border-red-800/50 bg-[var(--color-bg)] shadow-[0_20px_60px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="px-5 py-4 border-b border-red-800/40 text-sm font-semibold text-[#F48771]">读取执行过程失败</div>
        <div className="px-5 py-4 text-sm text-[var(--color-text)] whitespace-pre-wrap">{message}</div>
        <div className="px-5 py-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return String(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
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
