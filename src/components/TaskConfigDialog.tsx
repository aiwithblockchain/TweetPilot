import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import type { TaskType } from '@/services/task'
import { taskService } from '@/services'

interface TaskConfigDialogProps {
  onClose: () => void
  onTaskCreated: () => void
}

export default function TaskConfigDialog({ onClose, onTaskCreated }: TaskConfigDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('immediate')
  const [scriptPath, setScriptPath] = useState('')
  const [schedule, setSchedule] = useState('')
  const [scheduleMode, setScheduleMode] = useState<'simple' | 'advanced'>('simple')
  const [simpleSchedule, setSimpleSchedule] = useState({
    interval: '1',
    unit: 'hours',
  })
  const [parameters, setParameters] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectScript = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: 'Python Scripts',
            extensions: ['py'],
          },
        ],
      })

      if (selected) {
        setScriptPath(selected as string)
      }
    } catch (err) {
      console.error('Failed to select script:', err)
    }
  }

  const buildScheduleExpression = () => {
    if (scheduleMode === 'advanced') {
      return schedule
    }

    const { interval, unit } = simpleSchedule
    switch (unit) {
      case 'minutes':
        return `*/${interval} * * * *`
      case 'hours':
        return `0 */${interval} * * *`
      case 'days':
        return `0 0 */${interval} * *`
      default:
        return schedule
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('请输入任务名称')
      return
    }

    if (!scriptPath) {
      setError('请选择脚本文件')
      return
    }

    if (taskType === 'scheduled' && scheduleMode === 'advanced' && !schedule.trim()) {
      setError('请输入定时规则')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const config = {
        name: name.trim(),
        description: description.trim() || undefined,
        taskType,
        scriptPath,
        schedule: taskType === 'scheduled' ? buildScheduleExpression() : undefined,
        parameters,
      }

      await taskService.createTask(config)
      onTaskCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold">创建任务</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Task Name */}
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1.5">描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入任务描述"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none resize-none"
            />
          </div>

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">任务类型</label>
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

          {/* Script Path */}
          <div>
            <label className="block text-sm font-medium mb-1.5">脚本文件</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={scriptPath}
                readOnly
                placeholder="选择 Python 脚本文件"
                className="flex-1 h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
              />
              <button
                onClick={handleSelectScript}
                className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
              >
                浏览
              </button>
            </div>
          </div>

          {/* Task Parameters */}
          <div>
            <label className="block text-sm font-medium mb-1.5">任务参数</label>
            <div id="params-list" className="flex flex-col gap-2 mb-2">
              {Object.entries(parameters).map(([key, value], index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="参数名"
                    value={key}
                    onChange={(e) => {
                      const newParams = { ...parameters }
                      delete newParams[key]
                      newParams[e.target.value] = value
                      setParameters(newParams)
                    }}
                    className="flex-1 h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none font-mono"
                  />
                  <input
                    type="text"
                    placeholder="参数值"
                    value={value}
                    onChange={(e) => {
                      setParameters({ ...parameters, [key]: e.target.value })
                    }}
                    className="flex-1 h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      const newParams = { ...parameters }
                      delete newParams[key]
                      setParameters(newParams)
                    }}
                    className="h-8 w-8 flex items-center justify-center text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const newKey = `param${Object.keys(parameters).length + 1}`
                setParameters({ ...parameters, [newKey]: '' })
              }}
              className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
            >
              + 添加参数
            </button>
            <div className="mt-1.5 text-xs text-secondary">
              参数将以 --key value 形式传递给脚本
            </div>
          </div>

          {/* Schedule (only for scheduled tasks) */}
          {taskType === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">定时规则</label>
              <div className="flex gap-3 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="simple"
                    checked={scheduleMode === 'simple'}
                    onChange={(e) => setScheduleMode(e.target.value as 'simple' | 'advanced')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">简单模式</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="advanced"
                    checked={scheduleMode === 'advanced'}
                    onChange={(e) => setScheduleMode(e.target.value as 'simple' | 'advanced')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">高级模式</span>
                </label>
              </div>

              {scheduleMode === 'simple' ? (
                <div className="flex gap-2">
                  <span className="text-sm leading-8">每</span>
                  <input
                    type="number"
                    min="1"
                    value={simpleSchedule.interval}
                    onChange={(e) =>
                      setSimpleSchedule({ ...simpleSchedule, interval: e.target.value })
                    }
                    className="w-20 h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none"
                  />
                  <select
                    value={simpleSchedule.unit}
                    onChange={(e) =>
                      setSimpleSchedule({ ...simpleSchedule, unit: e.target.value })
                    }
                    className="h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none"
                  >
                    <option value="minutes">分钟</option>
                    <option value="hours">小时</option>
                    <option value="days">天</option>
                  </select>
                  <span className="text-sm leading-8">执行一次</span>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="输入 Cron 表达式，如：0 */2 * * *"
                    className="w-full h-8 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded focus:border-[#6D5BF6] focus:outline-none"
                  />
                  <div className="mt-1 text-xs text-secondary">
                    Cron 表达式格式：分 时 日 月 周
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
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
            onClick={handleCreate}
            disabled={creating}
            className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
          >
            {creating ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
