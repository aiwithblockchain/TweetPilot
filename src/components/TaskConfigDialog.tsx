import { useEffect, useMemo, useState } from 'react'
import type { MappedAccount, TaskAction, TaskType } from '@/services'
import { accountService, taskService } from '@/services'

type TaskFormAction = TaskAction

interface TaskConfigDialogProps {
  onClose: () => void
  onTaskCreated: (mode: 'create' | 'edit') => void
  initialValues?: TaskFormValues
  mode?: 'create' | 'edit'
}

interface TaskFormValues {
  id?: string
  name: string
  description?: string
  taskType: TaskType
  taskAction: TaskFormAction
  schedule?: string
  accountScreenName?: string
  tweetId?: string
  text?: string
  query?: string
}

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

const SCHEDULE_PRESETS = [
  { label: '每 30 分钟', value: '*/30 * * * *' },
  { label: '每 1 小时', value: '0 */1 * * *' },
  { label: '每天上午 9 点', value: '0 9 * * *' },
  { label: '每天晚上 8 点', value: '0 20 * * *' },
]

export default function TaskConfigDialog({
  onClose,
  onTaskCreated,
  initialValues,
  mode = 'create',
}: TaskConfigDialogProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [taskType, setTaskType] = useState<TaskType>(initialValues?.taskType ?? 'immediate')
  const [taskAction, setTaskAction] = useState<TaskFormAction>(
    initialValues?.taskAction ?? 'tweetclaw.post_tweet'
  )
  const [schedule, setSchedule] = useState(initialValues?.schedule ?? '0 */1 * * *')
  const [accountScreenName, setAccountScreenName] = useState(initialValues?.accountScreenName ?? '')
  const [tweetId, setTweetId] = useState(initialValues?.tweetId ?? '')
  const [text, setText] = useState(initialValues?.text ?? '')
  const [query, setQuery] = useState(initialValues?.query ?? '')
  const [accounts, setAccounts] = useState<MappedAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadAccounts = async () => {
      try {
        const result = await accountService.getMappedAccounts()
        if (!mounted) return
        setAccounts(result)
        setAccountScreenName((current) => current || result.find((item) => item.isLoggedIn)?.screenName || result[0]?.screenName || '')
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

    loadAccounts()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const presetName = ACTION_NAME_PRESETS[taskAction]
    setName((current) => (current.trim() ? current : presetName))
    setDescription((current) => current)
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
    if (!name.trim()) {
      return '请输入任务名称'
    }

    if (accountsLoading) {
      return '账号列表加载中，请稍后重试'
    }

    if (accounts.length === 0) {
      return '请先在账号管理中映射至少一个账号'
    }

    if (!accountScreenName) {
      return '请选择执行账号'
    }

    if (requiresTweetId && !tweetId.trim()) {
      return '请输入目标 tweetId'
    }

    if (requiresText && !text.trim()) {
      return taskAction === 'tweetclaw.post_tweet' ? '请输入推文内容' : '请输入回复内容'
    }

    if (taskType === 'scheduled' && !schedule.trim()) {
      return '请输入定时规则'
    }

    return null
  }

  const handleSubmit = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setCreating(true)
    setError(null)

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      taskType,
      scriptPath: taskAction,
      schedule: taskType === 'scheduled' ? schedule.trim() : undefined,
      accountScreenName,
      tweetId: requiresTweetId ? tweetId.trim() : undefined,
      text: requiresText ? text.trim() : undefined,
      query: query.trim() || undefined,
    }

    try {
      if (mode === 'edit' && initialValues?.id) {
        await taskService.updateTask(initialValues.id, payload)
        onTaskCreated('edit')
      } else {
        await taskService.createTask(payload)
        onTaskCreated('create')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'edit' ? '更新失败' : '创建失败')
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold">
            {mode === 'edit' ? '编辑任务' : '创建任务'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="text-xs text-secondary mb-1">任务动作</div>
            <div className="text-sm font-medium">{selectedAction.label}</div>
            <div className="text-xs text-secondary mt-1">{selectedAction.description}</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">任务名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入任务名称"
              className="w-full h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">任务描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="说明这个任务的触发场景或执行目标"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">执行方式</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="immediate"
                  checked={taskType === 'immediate'}
                  onChange={(e) => setTaskType(e.target.value as TaskType)}
                  className="w-4 h-4"
                />
                <span className="text-sm">即时任务</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="scheduled"
                  checked={taskType === 'scheduled'}
                  onChange={(e) => setTaskType(e.target.value as TaskType)}
                  className="w-4 h-4"
                />
                <span className="text-sm">定时任务</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">任务类型</label>
            <div className="grid gap-2 md:grid-cols-3">
              {ACTION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTaskAction(option.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    taskAction === option.value
                      ? 'border-[#6D5BF6] bg-[#6D5BF6]/5'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[#6D5BF6]/50'
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  <div className="mt-1 text-xs text-secondary">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">执行账号</label>
            <select
              value={accountScreenName}
              onChange={(e) => setAccountScreenName(e.target.value)}
              disabled={accountsLoading || accounts.length === 0}
              className="w-full h-9 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none disabled:opacity-60"
            >
              {accounts.length === 0 ? (
                <option value="">暂无可用账号</option>
              ) : (
                accounts.map((account) => (
                  <option key={account.screenName} value={account.screenName}>
                    @{account.screenName} · {account.displayName}
                    {account.isLoggedIn === false ? ' · 未登录' : ''}
                  </option>
                ))
              )}
            </select>
            {selectedAccount && (
              <div className="mt-1.5 text-xs text-secondary">
                当前账号状态：{selectedAccount.isLoggedIn === false ? '未登录' : '可执行'}
                {selectedAccount.extensionName ? `，实例：${selectedAccount.extensionName}` : ''}
              </div>
            )}
          </div>

          {requiresTweetId && (
            <div>
              <label className="block text-sm font-medium mb-1.5">目标 tweetId</label>
              <input
                type="text"
                value={tweetId}
                onChange={(e) => setTweetId(e.target.value)}
                placeholder="输入要回复或点赞的 tweetId"
                className="w-full h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none"
              />
            </div>
          )}

          {requiresText && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                {taskAction === 'tweetclaw.post_tweet' ? '推文内容' : '回复内容'}
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  taskAction === 'tweetclaw.post_tweet'
                    ? '输入要发布的推文内容'
                    : '输入要发送的回复内容'
                }
                rows={4}
                className="w-full px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none resize-y"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">查询备注（可选）</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="可用于记录关键词、来源或后续扩展信息"
              className="w-full h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none"
            />
          </div>

          {taskType === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Cron 定时规则</label>
              <div className="grid gap-2 md:grid-cols-2 mb-2">
                {SCHEDULE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setSchedule(preset.value)}
                    className={`rounded border px-3 py-2 text-left text-xs transition-colors ${
                      schedule === preset.value
                        ? 'border-[#6D5BF6] bg-[#6D5BF6]/5'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[#6D5BF6]/50'
                    }`}
                  >
                    <div className="font-medium text-sm text-[var(--color-text)]">{preset.label}</div>
                    <div className="mt-1 text-secondary font-mono">{preset.value}</div>
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="输入 Cron 表达式，如：0 */2 * * *"
                className="w-full h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none"
              />
              <div className="mt-1 text-xs text-secondary">格式：分 时 日 月 周</div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            disabled={creating}
            className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating}
            className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
          >
            {creating ? (mode === 'edit' ? '保存中...' : '创建中...') : mode === 'edit' ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
