import { Clock3, PlayCircle, Sparkles, TimerReset } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { taskService, getManagedAccountsForTaskSelection, type ManagedAccountForTask } from '@/services'
import type { Task, TaskConfigInput, TaskType } from '@/services'
import { ScriptSelector } from './ScriptSelector'
import { ParameterEditor } from './ParameterEditor'

function buildTaskFormState(task?: Task) {
  const scheduleType = task?.scheduleType || 'interval'
  const base = {
    name: task?.name || '',
    description: task?.description || '',
    taskType: (task?.type || 'immediate') as TaskType,
    scheduleType: scheduleType as 'interval' | 'cron',
    scriptPath: task?.scriptPath || '',
    parameters: ((task?.parameters || {}) as Record<string, string>),
    accountId: task?.accountId || '',
    intervalValue: 2,
    intervalUnit: 'hours' as 'minutes' | 'hours' | 'days',
    cronFields: { second: '0', minute: '0', hour: '9', day: '*', month: '*', weekday: '*' },
  }

  if (!task || task.type !== 'scheduled') {
    return base
  }

  if (task.scheduleType === 'interval' && task.intervalSeconds) {
    const seconds = task.intervalSeconds
    if (seconds % 86400 === 0) {
      base.intervalValue = seconds / 86400
      base.intervalUnit = 'days'
    } else if (seconds % 3600 === 0) {
      base.intervalValue = seconds / 3600
      base.intervalUnit = 'hours'
    } else {
      base.intervalValue = Math.max(1, Math.floor(seconds / 60))
      base.intervalUnit = 'minutes'
    }
  }

  if (task.scheduleType === 'cron' && task.schedule) {
    const parts = task.schedule.trim().split(/\s+/)
    if (parts.length === 6) {
      const utcHour = parseInt(parts[2], 10)
      const localHour = Number.isNaN(utcHour) ? parts[2] : String((utcHour + 8) % 24)
      base.cronFields = {
        second: parts[0],
        minute: parts[1],
        hour: localHour,
        day: parts[3],
        month: parts[4],
        weekday: parts[5],
      }
    }
  }

  return base
}

interface TaskCreatePaneProps {
  mode?: 'create' | 'edit'
  initialTask?: Task
  onCreated?: (taskId?: string) => void
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export function TaskCreatePane({ mode = 'create', initialTask, onCreated, onCancel, onDirtyChange }: TaskCreatePaneProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('immediate')
  const [scheduleType, setScheduleType] = useState<'interval' | 'cron'>('interval')
  const [scriptPath, setScriptPath] = useState('')
  const [parameters, setParameters] = useState<Record<string, string>>({})
  const [intervalValue, setIntervalValue] = useState(2)
  const [intervalUnit, setIntervalUnit] = useState<'minutes' | 'hours' | 'days'>('hours')
  const [cronFields, setCronFields] = useState({ second: '0', minute: '0', hour: '9', day: '*', month: '*', weekday: '*' })
  const [accountId, setAccountId] = useState('')
  const [accounts, setAccounts] = useState<ManagedAccountForTask[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [baselineSnapshot, setBaselineSnapshot] = useState('')

  useEffect(() => {
    getManagedAccountsForTaskSelection()
      .then(setAccounts)
      .catch((err) => {
        console.error('Failed to load managed accounts:', err)
        setAccounts([])
      })
      .finally(() => setAccountsLoading(false))
  }, [])

  useEffect(() => {
    const nextState = buildTaskFormState(initialTask)

    setName(nextState.name)
    setDescription(nextState.description)
    setTaskType(nextState.taskType)
    setScheduleType(nextState.scheduleType)
    setScriptPath(nextState.scriptPath)
    setParameters(nextState.parameters)
    setAccountId(nextState.accountId)
    setIntervalValue(nextState.intervalValue)
    setIntervalUnit(nextState.intervalUnit)
    setCronFields(nextState.cronFields)
    setError(null)
    setSuccessMessage(null)
    setBaselineSnapshot(JSON.stringify(nextState))
  }, [initialTask])

  const cronExpression = useMemo(() => {
    return `${cronFields.second} ${cronFields.minute} ${cronFields.hour} ${cronFields.day} ${cronFields.month} ${cronFields.weekday}`
  }, [cronFields])

  const cronDescription = useMemo(() => {
    const { minute, hour, day, month, weekday } = cronFields

    const parts: string[] = []

    if (hour === '*' && minute === '*') {
      parts.push('每分钟')
    } else if (hour === '*') {
      parts.push(`每小时的第 ${minute} 分钟`)
    } else if (minute === '0') {
      parts.push(`${hour} 点整`)
    } else {
      parts.push(`${hour}:${minute.padStart(2, '0')}`)
    }

    if (weekday !== '*' && day === '*') {
      const weekdays = ['日', '一', '二', '三', '四', '五', '六']
      parts.push(`每周${weekdays[parseInt(weekday)] || weekday}`)
    } else if (day !== '*' && month === '*') {
      parts.push(`每月 ${day} 号`)
    } else if (day === '*' && month === '*' && weekday === '*') {
      parts.push('每天')
    } else if (day !== '*' && month !== '*') {
      parts.push(`每年 ${month} 月 ${day} 号`)
    }

    return parts.join(' ')
  }, [cronFields])

  const scriptFileName = useMemo(() => {
    if (!scriptPath) return '未选择脚本'
    return scriptPath.split('/').pop() || scriptPath
  }, [scriptPath])

  const formSnapshot = useMemo(
    () => JSON.stringify({
      name,
      description,
      taskType,
      scheduleType,
      scriptPath,
      parameters,
      accountId,
      intervalValue,
      intervalUnit,
      cronFields,
    }),
    [name, description, taskType, scheduleType, scriptPath, parameters, accountId, intervalValue, intervalUnit, cronFields],
  )

  const isDirty = formSnapshot !== baselineSnapshot

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.twitterId === accountId),
    [accounts, accountId]
  )

  const selectedAccountDisplay = useMemo(() => {
    if (!selectedAccount) return '未指定'
    return selectedAccount.displayName || selectedAccount.screenName || selectedAccount.twitterId
  }, [selectedAccount])

  const validateForm = () => {
    if (!name.trim()) return '请输入任务名称'
    if (!scriptPath.trim()) return '请选择 Python 脚本'
    if (taskType === 'scheduled') {
      if (scheduleType === 'interval' && intervalValue < 1) {
        return '执行间隔必须大于 0'
      }
      if (scheduleType === 'cron') {
        const cronExpr = `${cronFields.second} ${cronFields.minute} ${cronFields.hour} ${cronFields.day} ${cronFields.month} ${cronFields.weekday}`
        const parts = cronExpr.trim().split(/\s+/)
        if (parts.length !== 6) {
          return 'Cron 表达式必须包含 6 个字段（秒 分 时 日 月 周）'
        }
        if (parts.some(p => !p || p.trim() === '')) {
          return 'Cron 表达式的每个字段都不能为空'
        }
      }
    }
    return null
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setTaskType('immediate')
    setScheduleType('interval')
    setScriptPath('')
    setParameters({})
    setIntervalValue(1)
    setIntervalUnit('hours')
    setCronFields({ second: '0', minute: '0', hour: '9', day: '*', month: '*', weekday: '*' })
    setAccountId('')
  }

  const getCronFromTemplate = (): string => {
    const localHour = parseInt(cronFields.hour)
    const utcHour = (localHour - 8 + 24) % 24
    return `${cronFields.second} ${cronFields.minute} ${utcHour} ${cronFields.day} ${cronFields.month} ${cronFields.weekday}`
  }

  const getIntervalSeconds = () => {
    switch (intervalUnit) {
      case 'minutes':
        return intervalValue * 60
      case 'hours':
        return intervalValue * 3600
      case 'days':
        return intervalValue * 86400
    }
  }

  const buildPayload = (): TaskConfigInput => ({
    name: name.trim(),
    description: description.trim() || undefined,
    taskType,
    scriptPath: scriptPath.trim(),
    scheduleType: taskType === 'scheduled' ? scheduleType : undefined,
    schedule: taskType === 'scheduled' && scheduleType === 'cron' ? getCronFromTemplate() : undefined,
    intervalSeconds: taskType === 'scheduled' && scheduleType === 'interval' ? getIntervalSeconds() : undefined,
    parameters,
    accountId: accountId || undefined,
    timeout: initialTask?.timeout,
    retryCount: initialTask?.retryCount,
    retryDelay: initialTask?.retryDelay,
    tags: initialTask?.tags,
  })

  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setSuccessMessage(null)
      return
    }

    setCreating(true)
    setError(null)
    setSuccessMessage(null)

    const payload = buildPayload()

    try {
      if (mode === 'edit' && initialTask) {
        await taskService.updateTask(initialTask.id, payload)
        setSuccessMessage('任务更新成功。')
        setBaselineSnapshot(formSnapshot)
        onDirtyChange?.(false)
        onCreated?.(initialTask.id)
      } else {
        const createdTask = await taskService.createTask(payload)
        setSuccessMessage(taskType === 'scheduled' ? '定时任务创建成功，已加入任务列表。' : '即时任务创建成功，已加入任务列表。')
        resetForm()
        onCreated?.(createdTask.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'edit' ? '更新失败' : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const isEditMode = mode === 'edit'

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.22)] bg-[linear-gradient(135deg,#6D5BF622_0%,#252526_50%,#171718_100%)]">
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-[var(--color-text)]">
                <Sparkles className="w-3.5 h-3.5" />
                {isEditMode ? '编辑任务' : '新建任务'}
              </div>
              <h2 className="text-2xl font-semibold text-white mt-4">{isEditMode ? '任务编辑工作台' : '任务创建工作台'}</h2>
              <p className="text-sm text-[#D4D4D4] mt-2 leading-6 max-w-2xl">
                {isEditMode
                  ? '修改任务脚本路径与现有配置，保存后立即执行和后续调度都会使用新配置。'
                  : '保留之前的即时任务 / 定时任务能力，但把它放进新的主显示区工作流，让创建体验更完整也更稳定。'}
              </p>
            </div>
            <div className="hidden md:flex w-20 h-20 rounded-2xl border border-white/10 bg-black/20 items-center justify-center shadow-inner">
              {taskType === 'scheduled' ? <Clock3 className="w-9 h-9 text-white/80" /> : <PlayCircle className="w-9 h-9 text-white/80" />}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            <HeroStat label="执行方式" value={taskType === 'scheduled' ? '定时任务' : '即时任务'} />
            <HeroStat label="脚本文件" value={scriptFileName} />
            <HeroStat label="目标账号" value={selectedAccountDisplay} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-5">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.16)] space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-4">
            <div className="text-sm font-semibold text-[var(--color-text)]">执行方式</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <ModeCard
                active={taskType === 'immediate'}
                title="即时任务"
                description="保存后可立即执行，适合临时发帖、回复、点赞。"
                icon={<PlayCircle className="w-5 h-5" />}
                onClick={() => setTaskType('immediate')}
              />
              <ModeCard
                active={taskType === 'scheduled'}
                title="定时任务"
                description="按固定频率自动执行，适合周期性同步或运营任务。"
                icon={<TimerReset className="w-5 h-5" />}
                onClick={() => setTaskType('scheduled')}
              />
            </div>
          </div>

          <Field label="Python 脚本">
            <ScriptSelector value={scriptPath} onChange={setScriptPath} />
          </Field>

          <Field label="执行账号（可选）">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={accountsLoading || accounts.length === 0}
              className="w-full h-10 rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#6D5BF6] disabled:opacity-60"
            >
              <option value="">不指定账号</option>
              {accounts.map((account) => (
                <option key={account.twitterId} value={account.twitterId}>
                  {account.displayName || account.screenName || account.twitterId}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
              账号信息当前仅随任务配置一起保存，脚本执行链路暂不通过环境变量注入。
            </div>
          </Field>

          <Field label="任务名称">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入任务名称"
              className="w-full h-10 rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#6D5BF6]"
            />
          </Field>

          <Field label="任务描述（可选）">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="说明这个脚本的用途或执行目标"
              rows={2}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[#6D5BF6] resize-none"
            />
          </Field>

          <Field label="任务参数（可选）">
            <ParameterEditor value={parameters} onChange={setParameters} />
          </Field>

          {taskType === 'scheduled' && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-4 space-y-4">
              <Field label="定时方式">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleType('interval')}
                    className={[
                      'rounded-xl border p-4 text-left transition-colors cursor-pointer',
                      scheduleType === 'interval' ? 'border-[#6D5BF6] bg-[#6D5BF6]/10' : 'border-[var(--color-border)] bg-[var(--color-input)] hover:border-[#6D5BF6]/50',
                    ].join(' ')}
                  >
                    <div className="text-sm font-medium text-[var(--color-text)] mb-2">简单间隔</div>
                    <div className="text-xs text-[var(--color-text-secondary)] leading-5">从现在开始，每隔固定时间执行一次</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType('cron')}
                    className={[
                      'rounded-xl border p-4 text-left transition-colors cursor-pointer',
                      scheduleType === 'cron' ? 'border-[#6D5BF6] bg-[#6D5BF6]/10' : 'border-[var(--color-border)] bg-[var(--color-input)] hover:border-[#6D5BF6]/50',
                    ].join(' ')}
                  >
                    <div className="text-sm font-medium text-[var(--color-text)] mb-2">固定时间 (Cron)</div>
                    <div className="text-xs text-[var(--color-text-secondary)] leading-5">在特定时间点执行（如每天早上9点）</div>
                  </button>
                </div>
              </Field>

              {scheduleType === 'interval' && (
                <Field label="执行间隔">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-[var(--color-text-secondary)]">每隔</span>
                    <input
                      type="number"
                      value={intervalValue}
                      onChange={(e) => setIntervalValue(Number(e.target.value))}
                      min="1"
                      className="w-24 h-10 rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#6D5BF6]"
                    />
                    <select
                      value={intervalUnit}
                      onChange={(e) => setIntervalUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                      className="h-10 rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#6D5BF6]"
                    >
                      <option value="minutes">分钟</option>
                      <option value="hours">小时</option>
                      <option value="days">天</option>
                    </select>
                    <span className="text-sm text-[var(--color-text-secondary)]">执行一次</span>
                  </div>
                  <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                    每次执行后，下次执行时间 = 当前时间 + {intervalValue} {intervalUnit === 'minutes' ? '分钟' : intervalUnit === 'hours' ? '小时' : '天'}
                  </div>
                </Field>
              )}

              {scheduleType === 'cron' && (
                <Field label="Cron 表达式（6字段格式）">
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => {
                      const parts = e.target.value.trim().split(/\s+/)
                      if (parts.length === 6) {
                        setCronFields({
                          second: parts[0],
                          minute: parts[1],
                          hour: parts[2],
                          day: parts[3],
                          month: parts[4],
                          weekday: parts[5],
                        })
                      }
                    }}
                    placeholder="0 0 9 * * * (每天早上9点)"
                    className="w-full h-10 rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text)] font-mono outline-none focus:border-[#6D5BF6]"
                  />
                  <div className="mt-2 p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1">预览：</div>
                    <div className="text-sm text-[#4EC9B0] font-medium">{cronDescription}</div>
                  </div>
                  <div className="mt-2 text-xs text-[var(--color-text-secondary)] space-y-1">
                    <div>格式：秒 分 时 日 月 周（使用空格分隔）</div>
                    <div>示例：</div>
                    <div className="font-mono">0 0 9 * * * - 每天早上9点</div>
                    <div className="font-mono">0 30 18 * * * - 每天晚上6点30分</div>
                    <div className="font-mono">0 0 9 * * 1 - 每周一早上9点</div>
                    <div className="font-mono">0 0 9 1 * * - 每月1号早上9点</div>
                  </div>
                </Field>
              )}
            </div>
          )}

          {error && <Message tone="error">{error}</Message>}
          {successMessage && <Message tone="success">{successMessage}</Message>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => (onCancel || onCreated)?.()}
              disabled={creating}
              className="h-10 px-5 rounded border border-[#3A3A3A] bg-[var(--color-bg)] text-[var(--color-text)] text-sm hover:border-[#4A4A4A] hover:bg-[var(--color-border)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isEditMode ? '取消编辑' : '取消创建'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={creating}
              className="h-10 px-5 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {creating ? (isEditMode ? '保存中...' : '创建中...') : (isEditMode ? '保存修改' : '创建任务')}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <SidePanel title="当前任务形态">
            <InfoLine label="执行方式" value={taskType === 'scheduled' ? '定时任务' : '即时任务'} />
            <InfoLine label="脚本文件" value={scriptFileName} />
            <InfoLine label="目标账号" value={selectedAccountDisplay} />
          </SidePanel>

          <SidePanel title="使用说明">
            <div className="space-y-2 text-sm text-[var(--color-text)] leading-7">
              <p>选择一个 Python 脚本文件，系统会自动执行并捕获输出。</p>
              <p>当前版本执行链路只按数据库中的脚本路径启动脚本，不消费任务参数。</p>
              <p>即时任务适合手动触发，定时任务适合周期性自动执行。</p>
            </div>
          </SidePanel>
        </aside>
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

function ModeCard({ active, title, description, icon, onClick }: { active: boolean; title: string; description: string; icon: React.ReactElement; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border p-4 text-left transition-colors cursor-pointer',
        active ? 'border-[#6D5BF6] bg-[#6D5BF6]/10' : 'border-[var(--color-border)] bg-[var(--color-input)] hover:border-[#6D5BF6]/50',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 text-[var(--color-text)]">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-xs text-[var(--color-text-secondary)] mt-2 leading-5">{description}</div>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-[var(--color-text)] mb-2">{label}</div>
      {children}
    </label>
  )
}

function Message({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div
      className={[
        'rounded-lg border px-4 py-3 text-sm',
        tone === 'error'
          ? 'border-red-800/50 bg-red-950/30 text-[#F48771]'
          : 'border-[#20432C] bg-[#1C2D23] text-[#4EC9B0]',
      ].join(' ')}
    >
      {children}
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-3 mb-3 last:mb-0">
      <div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-sm text-[var(--color-text)] mt-1 leading-6">{value}</div>
    </div>
  )
}
