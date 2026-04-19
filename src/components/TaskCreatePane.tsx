import { Clock3, PlayCircle, Sparkles, TimerReset } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { accountService, taskService } from '@/services'
import type { MappedAccount, TaskAction, TaskType } from '@/services'

interface TaskCreatePaneProps {
  onCreated?: (taskId?: string) => void
}

type TaskFormAction = TaskAction

const ACTION_OPTIONS: Array<{ value: TaskFormAction; label: string; description: string }> = [
  {
    value: 'tweetclaw.post_tweet',
    label: '发帖任务',
    description: '使用选定账号直接发布一条新推文',
  },
  {
    value: 'tweetclaw.reply_tweet',
    label: '回复任务',
    description: '针对指定 tweetId 发送回复内容',
  },
  {
    value: 'tweetclaw.like_tweet',
    label: '点赞任务',
    description: '使用选定账号为指定 tweetId 点赞',
  },
]

const ACTION_NAME_PRESETS: Record<TaskFormAction, string> = {
  'tweetclaw.post_tweet': '发布推文',
  'tweetclaw.reply_tweet': '回复推文',
  'tweetclaw.like_tweet': '点赞推文',
}

export function TaskCreatePane({ onCreated }: TaskCreatePaneProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('immediate')
  const [taskAction, setTaskAction] = useState<TaskFormAction>('tweetclaw.post_tweet')
  const [intervalValue, setIntervalValue] = useState(1)
  const [intervalUnit, setIntervalUnit] = useState<'minutes' | 'hours' | 'days'>('hours')
  const [accountScreenName, setAccountScreenName] = useState('')
  const [tweetId, setTweetId] = useState('')
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState<MappedAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadAccounts = async () => {
      try {
        const result = await accountService.getMappedAccounts()
        if (!mounted) return
        setAccounts(result)
        setAccountScreenName(result.find((item) => item.isLoggedIn)?.screenName || result[0]?.screenName || '')
      } catch (err) {
        console.error('Failed to load mapped accounts:', err)
        if (!mounted) return
        setError('加载账号失败，请先检查账号映射配置')
      } finally {
        if (mounted) {
          setAccountsLoading(false)
        }
      }
    }

    void loadAccounts()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const presetName = ACTION_NAME_PRESETS[taskAction]
    setName((current) => (current.trim() ? current : presetName))
  }, [taskAction])

  const selectedAction = useMemo(
    () => ACTION_OPTIONS.find((option) => option.value === taskAction) ?? ACTION_OPTIONS[0],
    [taskAction]
  )

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.screenName === accountScreenName) ?? null,
    [accounts, accountScreenName]
  )

  const requiresTweetId = taskAction === 'tweetclaw.reply_tweet' || taskAction === 'tweetclaw.like_tweet'
  const requiresText = taskAction === 'tweetclaw.post_tweet' || taskAction === 'tweetclaw.reply_tweet'

  const validateForm = () => {
    if (!name.trim()) return '请输入任务名称'
    if (accountsLoading) return '账号列表加载中，请稍后重试'
    if (accounts.length === 0) return '请先在账号管理中映射至少一个账号'
    if (!accountScreenName) return '请选择执行账号'
    if (requiresTweetId && !tweetId.trim()) return '请输入目标 tweetId'
    if (requiresText && !text.trim()) {
      return taskAction === 'tweetclaw.post_tweet' ? '请输入推文内容' : '请输入回复内容'
    }
    if (taskType === 'scheduled' && intervalValue < 1) return '执行间隔必须大于 0'
    return null
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setTaskType('immediate')
    setTaskAction('tweetclaw.post_tweet')
    setIntervalValue(1)
    setIntervalUnit('hours')
    setTweetId('')
    setText('')
    setQuery('')
  }

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

    const getIntervalMinutes = () => {
      switch (intervalUnit) {
        case 'minutes':
          return intervalValue
        case 'hours':
          return intervalValue * 60
        case 'days':
          return intervalValue * 1440
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      taskType,
      scriptPath: taskAction,
      schedule: taskType === 'scheduled' ? `*/${getIntervalMinutes()} * * * *` : undefined,
      accountScreenName,
      tweetId: requiresTweetId ? tweetId.trim() : undefined,
      text: requiresText ? text.trim() : undefined,
      query: query.trim() || undefined,
    }

    try {
      const createdTask = await taskService.createTask(payload)
      setSuccessMessage(taskType === 'scheduled' ? '定时任务创建成功，已加入任务列表。' : '即时任务创建成功，已加入任务列表。')
      resetForm()
      onCreated?.(createdTask.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl border border-[#2A2A2A] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.22)] bg-[linear-gradient(135deg,#6D5BF622_0%,#252526_50%,#171718_100%)]">
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-[#CCCCCC]">
                <Sparkles className="w-3.5 h-3.5" />
                新建任务
              </div>
              <h2 className="text-2xl font-semibold text-white mt-4">任务创建工作台</h2>
              <p className="text-sm text-[#D4D4D4] mt-2 leading-6 max-w-2xl">
                保留之前的即时任务 / 定时任务能力，但把它放进新的主显示区工作流，让创建体验更完整也更稳定。
              </p>
            </div>
            <div className="hidden md:flex w-20 h-20 rounded-2xl border border-white/10 bg-black/20 items-center justify-center shadow-inner">
              {taskType === 'scheduled' ? <Clock3 className="w-9 h-9 text-white/80" /> : <PlayCircle className="w-9 h-9 text-white/80" />}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            <HeroStat label="执行方式" value={taskType === 'scheduled' ? '定时任务' : '即时任务'} />
            <HeroStat label="任务动作" value={selectedAction.label} />
            <HeroStat label="目标账号" value={selectedAccount?.displayName ?? '请选择账号'} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-5">
        <section className="rounded-xl border border-[#2A2A2A] bg-[#252526] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.16)] space-y-4">
          <div className="rounded-xl border border-[#2A2A2A] bg-[#171718] p-4">
            <div className="text-sm font-semibold text-[#CCCCCC]">执行方式</div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="任务类型">
              <select
                value={taskAction}
                onChange={(e) => setTaskAction(e.target.value as TaskFormAction)}
                className="w-full h-10 rounded border border-[#2A2A2A] bg-[#171718] px-3 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6]"
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-[#858585] leading-5">{selectedAction.description}</div>
            </Field>

            <Field label="执行账号">
              <select
                value={accountScreenName}
                onChange={(e) => setAccountScreenName(e.target.value)}
                disabled={accountsLoading || accounts.length === 0}
                className="w-full h-10 rounded border border-[#2A2A2A] bg-[#171718] px-3 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6] disabled:opacity-60"
              >
                {accounts.length === 0 ? (
                  <option value="">暂无可用账号</option>
                ) : (
                  accounts.map((account) => (
                    <option key={account.screenName} value={account.screenName}>
                      {account.displayName} · {account.screenName}
                    </option>
                  ))
                )}
              </select>
              {selectedAccount && (
                <div className="mt-2 text-xs text-[#858585]">
                  当前账号状态：{selectedAccount.isLoggedIn === false ? '未登录' : '可执行'}
                  {selectedAccount.extensionName ? `，实例：${selectedAccount.extensionName}` : ''}
                </div>
              )}
            </Field>
          </div>

          <Field label="任务名称">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入任务名称"
              className="w-full h-10 rounded border border-[#2A2A2A] bg-[#171718] px-3 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6]"
            />
          </Field>

          <Field label="任务描述（可选）">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="说明这个任务的触发场景或执行目标"
              rows={2}
              className="w-full rounded border border-[#2A2A2A] bg-[#171718] px-3 py-2 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6] resize-none"
            />
          </Field>

          {requiresTweetId && (
            <Field label="目标 tweetId">
              <input
                type="text"
                value={tweetId}
                onChange={(e) => setTweetId(e.target.value)}
                placeholder="输入要回复或点赞的 tweetId"
                className="w-full h-10 rounded border border-[#2A2A2A] bg-[#171718] px-3 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6]"
              />
            </Field>
          )}

          {requiresText && (
            <Field label={taskAction === 'tweetclaw.post_tweet' ? '推文内容' : '回复内容'}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={taskAction === 'tweetclaw.post_tweet' ? '输入要发布的推文内容' : '输入要发送的回复内容'}
                rows={4}
                className="w-full rounded border border-[#2A2A2A] bg-[#171718] px-3 py-2 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6] resize-y"
              />
            </Field>
          )}

          <Field label="查询备注（可选）">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="记录关键词、来源或后续扩展信息"
              className="w-full h-10 rounded border border-[#2A2A2A] bg-[#171718] px-3 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6]"
            />
          </Field>

          {taskType === 'scheduled' && (
            <div className="rounded-xl border border-[#2A2A2A] bg-[#171718] p-4">
              <Field label="执行间隔">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                    min="1"
                    className="w-24 h-10 rounded border border-[#2A2A2A] bg-[#111112] px-3 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6]"
                  />
                  <select
                    value={intervalUnit}
                    onChange={(e) => setIntervalUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                    className="h-10 rounded border border-[#2A2A2A] bg-[#111112] px-3 text-sm text-[#CCCCCC] outline-none focus:border-[#6D5BF6]"
                  >
                    <option value="minutes">分钟</option>
                    <option value="hours">小时</option>
                    <option value="days">天</option>
                  </select>
                  <span className="text-sm text-[#858585]">执行一次</span>
                </div>
              </Field>
            </div>
          )}

          {error && <Message tone="error">{error}</Message>}
          {successMessage && <Message tone="success">{successMessage}</Message>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={creating}
              className="h-10 px-5 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
            >
              {creating ? '创建中...' : '创建任务'}
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <SidePanel title="当前任务形态">
            <InfoLine label="执行方式" value={taskType === 'scheduled' ? '定时任务' : '即时任务'} />
            <InfoLine label="动作" value={selectedAction.label} />
            <InfoLine label="目标账号" value={selectedAccount?.displayName ?? '未选择'} />
          </SidePanel>

          <SidePanel title="创建说明">
            <div className="space-y-2 text-sm text-[#CCCCCC] leading-7">
              <p>即时任务适合人工触发的一次性动作，比如发一条推文、回复某条推文或点赞。</p>
              <p>定时任务适合周期执行的运营动作，比如每隔几小时同步或定时发帖。</p>
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

function ModeCard({ active, title, description, icon, onClick }: { active: boolean; title: string; description: string; icon: JSX.Element; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border p-4 text-left transition-colors',
        active ? 'border-[#6D5BF6] bg-[#6D5BF6]/10' : 'border-[#2A2A2A] bg-[#171718] hover:border-[#6D5BF6]/50',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 text-[#CCCCCC]">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="text-xs text-[#858585] mt-2 leading-5">{description}</div>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-[#CCCCCC] mb-2">{label}</div>
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
          ? 'border-[#5A1D1D] bg-[#3A1F1F] text-[#F48771]'
          : 'border-[#20432C] bg-[#1C2D23] text-[#4EC9B0]',
      ].join(' ')}
    >
      {children}
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#171718] p-3 mb-3 last:mb-0">
      <div className="text-[11px] text-[#858585]">{label}</div>
      <div className="text-sm text-[#CCCCCC] mt-1 leading-6">{value}</div>
    </div>
  )
}
