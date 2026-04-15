import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Task, ExecutionResult } from '../pages/TaskManagement'

interface TaskDetailSidebarProps {
  taskId: string
  onClose: () => void
}

interface TaskDetail {
  task: Task
  executionHistory?: ExecutionResult[]
  failureLog?: ExecutionResult[]
}

type TabType = 'config' | 'stats' | 'history' | 'last-execution' | 'failures'

export default function TaskDetailSidebar({ taskId, onClose }: TaskDetailSidebarProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('config')

  useEffect(() => {
    loadTaskDetail()
  }, [taskId])

  const loadTaskDetail = async () => {
    try {
      const result = await invoke<TaskDetail>('get_task_detail', { taskId })
      setDetail(result)
      // Set default tab based on task type
      if (result.task.type === 'immediate') {
        setActiveTab('config')
      } else {
        setActiveTab('config')
      }
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

  if (loading || !detail) {
    return (
      <div className="fixed right-0 top-0 h-full w-96 bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-lg flex items-center justify-center">
        <div className="text-sm text-secondary">加载中...</div>
      </div>
    )
  }

  const { task, executionHistory = [], failureLog = [] } = detail

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
              <div className="text-xs text-secondary mb-1">任务类型</div>
              <div>{task.type === 'scheduled' ? '定时任务' : '即时任务'}</div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">脚本路径</div>
              <div className="text-xs break-all">{task.scriptPath}</div>
            </div>
            {task.type === 'scheduled' && (
              <div>
                <div className="text-xs text-secondary mb-1">执行规则</div>
                <div>{task.schedule}</div>
              </div>
            )}
            {task.parameters && Object.keys(task.parameters).length > 0 && (
              <div>
                <div className="text-xs text-secondary mb-1">参数</div>
                <div className="text-xs bg-[var(--color-surface)] p-2 rounded">
                  <pre>{JSON.stringify(task.parameters, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && task.statistics && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-secondary mb-1">总执行次数</div>
              <div>{task.statistics.totalExecutions}</div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">成功次数</div>
              <div className="text-green-500">{task.statistics.successCount}</div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">失败次数</div>
              <div className="text-red-500">{task.statistics.failureCount}</div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">成功率</div>
              <div>{task.statistics.successRate}%</div>
            </div>
            <div>
              <div className="text-xs text-secondary mb-1">平均耗时</div>
              <div>{task.statistics.averageDuration} 秒</div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {executionHistory.length === 0 ? (
              <div className="text-center text-sm text-secondary py-8">暂无执行历史</div>
            ) : (
              executionHistory.map((exec, index) => (
                <div
                  key={index}
                  className="p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-xs"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-secondary">{formatDate(exec.startTime)}</span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        exec.status === 'success'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {exec.status === 'success' ? '成功' : '失败'}
                    </span>
                  </div>
                  <div className="text-secondary">耗时：{exec.duration.toFixed(2)} 秒</div>
                  {exec.error && (
                    <div className="mt-2 p-2 bg-red-500/10 rounded text-red-500">
                      {exec.error}
                    </div>
                  )}
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
                  <div className="text-xs text-secondary mb-1">执行时间</div>
                  <div>{formatDate(task.lastExecution.startTime)}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary mb-1">耗时</div>
                  <div>{task.lastExecution.duration.toFixed(2)} 秒</div>
                </div>
                {task.lastExecution.output && (
                  <div>
                    <div className="text-xs text-secondary mb-1">输出</div>
                    <pre className="text-xs bg-[var(--color-surface)] p-2 rounded overflow-x-auto">
                      {task.lastExecution.output}
                    </pre>
                  </div>
                )}
                {task.lastExecution.error && (
                  <div>
                    <div className="text-xs text-secondary mb-1">错误信息</div>
                    <pre className="text-xs bg-red-500/10 text-red-500 p-2 rounded overflow-x-auto">
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
                  className="p-3 bg-red-500/10 border border-red-500 rounded text-xs"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-secondary">{formatDate(exec.startTime)}</span>
                    <span className="text-red-500">失败</span>
                  </div>
                  <div className="text-secondary mb-2">耗时：{exec.duration.toFixed(2)} 秒</div>
                  {exec.error && (
                    <div className="p-2 bg-red-500/20 rounded text-red-500">
                      {exec.error}
                    </div>
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
