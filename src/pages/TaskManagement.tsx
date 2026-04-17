import { useMemo, useState, useEffect } from 'react'
import TaskCard from '../components/TaskCard'
import TaskConfigDialog from '../components/TaskConfigDialog'
import TaskDetailSidebar from '../components/TaskDetailSidebar'
import ExecutingModal from '../components/ExecutingModal'
import ExecutionResultModal from '../components/ExecutionResultModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { taskService } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type { ExecutionResult, Task, TaskAction } from '@/services/task'

export type { ExecutionResult, Task }

type FilterType = 'all' | 'immediate' | 'scheduled' | 'failed'

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all')
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [executingTask, setExecutingTask] = useState<Task | null>(null)
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const result = await taskService.getTasks()
      setTasks(result)
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredTasks = () => {
    switch (currentFilter) {
      case 'immediate':
        return tasks.filter((t) => t.type === 'immediate')
      case 'scheduled':
        return tasks.filter((t) => t.type === 'scheduled')
      case 'failed':
        return tasks.filter((t) => {
          if (t.type === 'immediate') {
            return t.lastExecution?.status === 'failure'
          } else {
            return (t.statistics?.failureCount ?? 0) > 0
          }
        })
      default:
        return tasks
    }
  }

  const handleTaskCreated = (mode: 'create' | 'edit') => {
    setShowConfigDialog(false)
    setEditingTask(null)
    loadTasks()
    if (mode === 'edit') {
      toast.success('任务更新成功')
    } else {
      toast.success('任务创建成功')
    }
  }

  const handleTaskEdit = (task: Task) => {
    setEditingTask(task)
    setShowConfigDialog(true)
  }

  const handleTaskDeleted = (taskId: string) => {
    setDeleteTaskId(taskId)
  }

  const confirmDeleteTask = async () => {
    if (!deleteTaskId) return

    try {
      await taskService.deleteTask(deleteTaskId)
      setTasks((prev) => prev.filter((t) => t.id !== deleteTaskId))
      if (selectedTaskId === deleteTaskId) {
        setSelectedTaskId(null)
      }
      toast.success('任务删除成功')
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast.error('删除失败: ' + (error as Error).message)
    } finally {
      setDeleteTaskId(null)
    }
  }

  const handleTaskExecute = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // Show executing modal
    setExecutingTask(task)

    try {
      // Call backend to execute task
      const result = await taskService.executeTask(taskId)

      // Close executing modal
      setExecutingTask(null)

      // Show result modal
      setExecutionResult(result)

      // Reload tasks to get updated status
      await loadTasks()
    } catch (error) {
      console.error('Failed to execute task:', error)
      setExecutingTask(null)
      toast.error('执行失败: ' + (error as Error).message)
    }
  }

  const handleTaskPause = async (taskId: string) => {
    try {
      await taskService.pauseTask(taskId)
      await loadTasks()
    } catch (error) {
      console.error('Failed to pause task:', error)
    }
  }

  const handleTaskResume = async (taskId: string) => {
    try {
      await taskService.resumeTask(taskId)
      await loadTasks()
    } catch (error) {
      console.error('Failed to resume task:', error)
    }
  }

  const filteredTasks = useMemo(() => getFilteredTasks(), [tasks, currentFilter])

  const taskSummary = useMemo(() => {
    const immediateCount = tasks.filter((task) => task.type === 'immediate').length
    const scheduledCount = tasks.filter((task) => task.type === 'scheduled').length
    const failedCount = tasks.filter((task) => {
      if (task.type === 'immediate') {
        return task.lastExecution?.status === 'failure'
      }
      return (task.statistics?.failureCount ?? 0) > 0
    }).length

    return {
      total: tasks.length,
      immediateCount,
      scheduledCount,
      failedCount,
    }
  }, [tasks])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-secondary">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-lg font-semibold">任务管理</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            管理 tweetClaw 发帖、回复、点赞任务，并按账号或执行方式查看状态。
          </p>
        </div>
        <button
          onClick={() => {
            setEditingTask(null)
            setShowConfigDialog(true)
          }}
          className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
        >
          创建任务
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/40">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="text-xs text-secondary mb-1">任务总数</div>
          <div className="text-2xl font-semibold">{taskSummary.total}</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="text-xs text-secondary mb-1">即时任务</div>
          <div className="text-2xl font-semibold">{taskSummary.immediateCount}</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="text-xs text-secondary mb-1">定时任务</div>
          <div className="text-2xl font-semibold">{taskSummary.scheduledCount}</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="text-xs text-secondary mb-1">存在失败记录</div>
          <div className="text-2xl font-semibold text-red-500">{taskSummary.failedCount}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 py-3 border-b border-[var(--color-border)]">
        <button
          onClick={() => setCurrentFilter('all')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            currentFilter === 'all'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
          }`}
        >
          全部任务
        </button>
        <button
          onClick={() => setCurrentFilter('immediate')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            currentFilter === 'immediate'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
          }`}
        >
          即时任务
        </button>
        <button
          onClick={() => setCurrentFilter('scheduled')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            currentFilter === 'scheduled'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
          }`}
        >
          定时任务
        </button>
        <button
          onClick={() => setCurrentFilter('failed')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            currentFilter === 'failed'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
          }`}
        >
          失败记录
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto p-4">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-4xl mb-3">📋</div>
            <div className="text-base font-medium mb-1">
              {currentFilter === 'all' ? '还没有可执行任务' : '当前筛选条件下暂无任务'}
            </div>
            <div className="text-xs text-secondary max-w-sm leading-5">
              {currentFilter === 'all'
                ? '先在账号管理中确认映射账号可用，然后创建 tweetClaw 发帖、回复或点赞任务。'
                : '切换筛选条件，或创建新的 tweetClaw 任务来补充当前列表。'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onViewDetail={() => setSelectedTaskId(task.id)}
                onEdit={() => handleTaskEdit(task)}
                onExecute={() => handleTaskExecute(task.id)}
                onPause={() => handleTaskPause(task.id)}
                onResume={() => handleTaskResume(task.id)}
                onDelete={() => handleTaskDeleted(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Task Config Dialog */}
      {showConfigDialog && (
        <TaskConfigDialog
          mode={editingTask ? 'edit' : 'create'}
          initialValues={
            editingTask
              ? {
                  id: editingTask.id,
                  name: editingTask.name,
                  description: editingTask.description,
                  taskType: editingTask.type,
                  taskAction: editingTask.scriptPath as TaskAction,
                  schedule: editingTask.schedule,
                  accountScreenName: editingTask.accountScreenName,
                  tweetId: editingTask.tweetId,
                  text: editingTask.text,
                  query: editingTask.query,
                }
              : undefined
          }
          onClose={() => {
            setShowConfigDialog(false)
            setEditingTask(null)
          }}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {/* Task Detail Sidebar */}
      {selectedTaskId && (
        <TaskDetailSidebar
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onEdit={(task) => {
            setSelectedTaskId(null)
            handleTaskEdit(task)
          }}
        />
      )}

      {/* Executing Modal */}
      {executingTask && <ExecutingModal taskName={executingTask.name} />}

      {/* Execution Result Modal */}
      {executionResult && (
        <ExecutionResultModal result={executionResult} onClose={() => setExecutionResult(null)} />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTaskId !== null}
        title="删除任务"
        message="确定要删除这个任务吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        danger={true}
        onConfirm={confirmDeleteTask}
        onCancel={() => setDeleteTaskId(null)}
      />
    </div>
  )
}
