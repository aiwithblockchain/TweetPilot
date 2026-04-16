import { useState, useEffect } from 'react'
import { taskService } from '@/services'
import type { TaskDetail } from '@/services/task'

interface TaskDetailSidebarProps {
  taskId: string
  onClose: () => void
}

type TabType = 'config' | 'stats' | 'history' | 'last-execution' | 'failures'

export default function TaskDetailSidebar({ taskId, onClose }: TaskDetailSidebarProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('config')
  const [parameters, setParameters] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadTaskDetail()
  }, [taskId])

  const loadTaskDetail = async () => {
    try {
      const result = await taskService.getTaskDetail(taskId)
      setDetail(result)
      setParameters(result.task.parameters || {})
      setActiveTab('config')
    } catch (error) {
      console.error('Failed to load task detail:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const handleParamChange = (oldKey: string, newKey: string, value: string) => {
    setParameters((prev) => {
      const updated = { ...prev }
      if (oldKey !== newKey && oldKey in updated) {
        delete updated[oldKey]
      }
      if (newKey.trim()) {
        updated[newKey] = value
      }
      return updated
    })
    setHasChanges(true)
  }

  const handleParamDelete = (key: string) => {
    setParameters((prev) => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
    setHasChanges(true)
  }

  const handleAddParam = () => {
    const newKey = `param${Object.keys(parameters).length + 1}`
    setParameters((prev) => ({ ...prev, [newKey]: '' }))
    setHasChanges(true)
  }

  const handleSaveParams = async () => {
    try {
      // TODO: Call backend to update task parameters
      console.log('Saving parameters:', parameters)
      setHasChanges(false)
      // Show success message
      alert('参数已保存')
    } catch (error) {
      console.error('Failed to save parameters:', error)
      alert('保存失败')
    }
  }

  if (loading || !detail) {
    return (
      <div className="fixed right-0 top-0 h-full w-96 bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-lg flex items-center justify-center">
        <div className="text-sm text-secondary">加载中...</div>
      </div>
    )
  }

  const { task, statistics, history = [], failureLog = [] } = detail

  const tabs: { key: TabType; label: string }[] =
    task.type === 'immediate'
      ? [
          { key: 'config', label: '配置' },
          { key: 'last-execution', label: '最后执行' },
          { key: 'failures', label: '失败记录' },
        ]
      : [
          { key: 'config', label: '配置' },
          { key: 'stats', label: '统计' },
          { key: 'history', label: '执行历史' },
          { key: 'failures', label: '失败记录' },
        ]

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-lg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h3 className="text-base font-semibold">任务详情</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeTab === tab.key
                ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'config' && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-secondary mb-1">任务名称</div>
              <div>{task.name}</div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">描述</div>
              <div>{task.description || '无'}</div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">脚本路径</div>
              <div className="text-xs break-all font-mono">{task.scriptPath}</div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">任务类型</div>
              <div>{task.type === 'scheduled' ? '定时任务' : '即时任务'}</div>
            </div>
            {task.type === 'scheduled' && task.schedule && (
              <div>
                <div className="text-xs text-secondary mb-1">执行规则</div>
                <div>{task.schedule}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-secondary mb-1">任务参数</div>
              <div className="flex flex-col gap-1.5 mb-2">
                {Object.entries(parameters).map(([key, value]) => (
                  <div key={key} className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => handleParamChange(key, e.target.value, value)}
                      placeholder="参数名"
                      className="flex-1 px-2 py-1 text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleParamChange(key, key, e.target.value)}
                      placeholder="参数值"
                      className="flex-1 px-2 py-1 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                    />
                    <button
                      onClick={() => handleParamDelete(key)}
                      className="px-2 py-1 text-xs bg-[var(--color-surface)] hover:bg-red-500/10 hover:text-red-500 border border-[var(--color-border)] rounded transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddParam}
                className="w-full px-2 py-1 text-xs bg-[var(--color-surface)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] rounded transition-colors"
              >
                + 添加参数
              </button>
              <div className="text-xs text-secondary mt-1">
                参数将以 --key value 形式传递给脚本
              </div>
              {hasChanges && (
                <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-orange-500">⚠️ 有未保存的修改</span>
                  </div>
                  <button
                    onClick={handleSaveParams}
                    className="w-full h-7 px-3 text-xs bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
                  >
                    保存修改
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && statistics && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--color-surface)] rounded text-center">
              <div className="text-2xl font-semibold mb-1">{statistics.totalExecutions}</div>
              <div className="text-xs text-secondary">总执行次数</div>
            </div>
            <div className="p-3 bg-[var(--color-surface)] rounded text-center">
              <div className="text-2xl font-semibold mb-1 text-green-500">
                {statistics.successCount}
              </div>
              <div className="text-xs text-secondary">成功次数</div>
            </div>
            <div className="p-3 bg-[var(--color-surface)] rounded text-center">
              <div className="text-2xl font-semibold mb-1 text-red-500">
                {statistics.failureCount}
              </div>
              <div className="text-xs text-secondary">失败次数</div>
            </div>
            <div className="p-3 bg-[var(--color-surface)] rounded text-center">
              <div className="text-2xl font-semibold mb-1">{statistics.successRate}%</div>
              <div className="text-xs text-secondary">成功率</div>
            </div>
            <div className="p-3 bg-[var(--color-surface)] rounded text-center col-span-2">
              <div className="text-2xl font-semibold mb-1">{statistics.averageDuration}s</div>
              <div className="text-xs text-secondary">平均时长</div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="text-center text-sm text-secondary py-8">暂无执行历史</div>
            ) : (
              history.map((exec, index) => (
                <div
                  key={index}
                  className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
                >
                  <div className="flex justify-between items-center mb-2 text-xs">
                    <span className="text-secondary">{formatDate(exec.startTime)}</span>
                    <span className="text-secondary">{exec.duration.toFixed(1)}s</span>
                  </div>
                  <div
                    className={`inline-block px-2 py-0.5 text-xs rounded ${
                      exec.status === 'success'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {exec.status === 'success' ? '成功' : '失败'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'last-execution' && (
          <div>
            {task.lastExecution ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-secondary mb-1">执行状态</div>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded ${
                      task.lastExecution.status === 'success'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}
                  >
                    {task.lastExecution.status === 'success' ? '成功' : '失败'}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-secondary mb-1">开始时间</div>
                  <div>{formatDate(task.lastExecution.startTime)}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary mb-1">结束时间</div>
                  <div>{formatDate(task.lastExecution.endTime)}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary mb-1">耗时</div>
                  <div>{task.lastExecution.duration.toFixed(2)} 秒</div>
                </div>
                {task.lastExecution.output && (
                  <div>
                    <div className="text-xs text-secondary mb-1">输出</div>
                    <pre className="text-xs bg-[var(--color-surface)] p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {task.lastExecution.output}
                    </pre>
                  </div>
                )}
                {task.lastExecution.error && (
                  <div>
                    <div className="text-xs text-secondary mb-1">错误信息</div>
                    <pre className="text-xs bg-red-500/10 text-red-500 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {task.lastExecution.error}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-sm text-secondary py-8">尚未执行</div>
            )}
          </div>
        )}

        {activeTab === 'failures' && (
          <div className="space-y-2">
            {failureLog.length === 0 ? (
              <div className="text-center text-sm text-secondary py-8">暂无失败记录</div>
            ) : (
              failureLog.map((exec, index) => (
                <div
                  key={index}
                  className="p-3 bg-red-500/10 border border-red-500 rounded"
                >
                  <div className="flex justify-between items-center mb-2 text-xs">
                    <span className="text-secondary">{formatDate(exec.startTime)}</span>
                    <span className="text-secondary">{exec.duration.toFixed(1)}s</span>
                  </div>
                  <div className="text-xs text-red-500 mb-2">失败</div>
                  {exec.error && (
                    <pre className="text-xs bg-red-500/20 text-red-500 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                      {exec.error}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
