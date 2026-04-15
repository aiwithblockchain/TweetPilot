import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import TaskCard from '../components/TaskCard'
import TaskConfigDialog from '../components/TaskConfigDialog'
import TaskDetailSidebar from '../components/TaskDetailSidebar'

export type TaskType = 'immediate' | 'scheduled'
export type TaskStatus = 'idle' | 'running' | 'paused'

export interface Task {
  id: string
  name: string
  description?: string
  type: TaskType
  scriptPath: string
  parameters?: Record<string, string>
  status: TaskStatus
  // Immediate task fields
  lastExecution?: ExecutionResult
  // Scheduled task fields
  schedule?: string
  nextExecutionTime?: string
  lastExecutionTime?: string
  statistics?: TaskStatistics
}

export interface ExecutionResult {
  startTime: string
  endTime: string
  status: 'success' | 'failure'
  output: string
  error?: string
  duration: number
}

export interface TaskStatistics {
  totalExecutions: number
  successCount: number
  failureCount: number
  successRate: number
  averageDuration: number
}

type FilterType = 'all' | 'immediate' | 'scheduled' | 'failed'

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all')
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    try {
      const result = await invoke<Task[]>('get_tasks')
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

  const handleTaskCreated = () => {
    setShowConfigDialog(false)
    loadTasks()
  }

  const handleTaskDeleted = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) {
      return
    }

    try {
      await invoke('delete_task', { taskId })
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null)
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
      alert('删除失败: ' + (error as Error).message)
    }
  }

  const handleTaskExecute = async (taskId: string) => {
    try {
      await invoke('execute_task', { taskId })
      loadTasks()
    } catch (error) {
      console.error('Failed to execute task:', error)
      alert('执行失败: ' + (error as Error).message)
    }
  }

  const handleTaskPause = async (taskId: string) => {
    try {
      await invoke('pause_task', { taskId })
      loadTasks()
    } catch (error) {
      console.error('Failed to pause task:', error)
    }
  }

  const handleTaskResume = async (taskId: string) => {
    try {
      await invoke('resume_task', { taskId })
      loadTasks()
    } catch (error) {
      console.error('Failed to resume task:', error)
    }
  }

  const filteredTasks = getFilteredTasks()

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
        <h2 className="text-lg font-semibold">任务管理</h2>
        <button
          onClick={() => setShowConfigDialog(true)}
          className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
        >
          创建任务
        </button>
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
            <div className="text-base font-medium mb-1">暂无任务</div>
            <div className="text-xs text-secondary">点击"创建任务"按钮添加第一个任务</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onViewDetail={() => setSelectedTaskId(task.id)}
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
          onClose={() => setShowConfigDialog(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {/* Task Detail Sidebar */}
      {selectedTaskId && (
        <TaskDetailSidebar
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}
