import { useEffect, useState } from 'react'
import { taskService } from '@/services'
import type { Task } from '@/services/task'

function getTaskBadge(task: Task): { badge?: string; badgeTone?: 'default' | 'success' | 'warning' | 'danger' } {
  if (task.status === 'failed' || task.lastExecutionStatus === 'failure') {
    return { badge: '失败', badgeTone: 'danger' }
  }

  if (task.status === 'running') {
    return { badge: '运行中', badgeTone: 'success' }
  }

  if (task.type === 'scheduled') {
    return { badge: '定时', badgeTone: 'warning' }
  }

  return { badge: '即时', badgeTone: 'default' }
}

export function useTasksSidebarItems() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTasks = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await taskService.getTasks()
      setTasks(result)
    } catch (err) {
      console.error('Failed to load tasks for sidebar:', err)
      setError(err instanceof Error ? err.message : '读取任务失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [])

  const items = tasks.map((task) => ({
    id: task.id,
    label: task.name,
    description:
      task.type === 'scheduled'
        ? task.schedule || '定时任务'
        : task.lastExecutionStatus === 'failure'
          ? '即时任务 / 最近失败'
          : '即时任务',
    ...getTaskBadge(task),
  }))

  return {
    tasks,
    items,
    loading,
    error,
    reload: loadTasks,
  }
}
