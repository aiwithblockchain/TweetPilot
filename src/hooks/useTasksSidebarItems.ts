import { useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { taskService, workspaceService } from '@/services'
import type { Task } from '@/services/task'
import { convertCronToLocalTime } from '@/lib/cron-utils'
import { formatForLog, toSafeError } from '@/lib/safe-logging'

type TaskBadgeTone = 'default' | 'success' | 'warning' | 'danger'

function getTaskBadge(task: Task): { badge?: string; badgeTone?: TaskBadgeTone } {
  if (task.status === 'failed' || task.lastExecutionStatus === 'failure') {
    return { badge: '失败', badgeTone: 'danger' }
  }

  if (task.status === 'running') {
    return { badge: '运行中', badgeTone: 'success' }
  }

  return {}
}

function getTaskMetaBadges(task: Task): Array<{ label: string; tone: TaskBadgeTone }> {
  return [
    {
      label: task.executionMode === 'ai_session' ? 'AI' : 'Python',
      tone: task.executionMode === 'ai_session' ? 'success' : 'default',
    },
    {
      label: task.type === 'scheduled' ? '定时' : '即时',
      tone: task.type === 'scheduled' ? 'warning' : 'default',
    },
  ]
}

export function useTasksSidebarItems() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTasks = async () => {
    try {
      console.log('[useTasksSidebarItems] Starting loadTasks')
      setLoading(true)
      setError(null)

      console.log('[useTasksSidebarItems] Checking current workspace')
      const currentWorkspace = await workspaceService.getCurrentWorkspace()
      console.log('[useTasksSidebarItems] Current workspace:', formatForLog({ currentWorkspace }))

      if (!currentWorkspace) {
        console.log('[useTasksSidebarItems] No workspace selected, setting empty tasks')
        setTasks([])
        setLoading(false)
        return
      }

      console.log('[useTasksSidebarItems] Fetching tasks from backend')
      const result = await taskService.getTasks()
      console.log('[useTasksSidebarItems] Tasks fetched:', formatForLog({ count: result.length }))
      setTasks(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '读取任务失败'
      console.error('[useTasksSidebarItems] Error loading tasks:', errorMessage)

      if (errorMessage.includes('数据库未初始化')) {
        console.log('[useTasksSidebarItems] Database not initialized, silently setting empty tasks')
        setTasks([])
        setError(null)
      } else {
        console.error('[useTasksSidebarItems] Unexpected error:', toSafeError(err))
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
      console.log('[useTasksSidebarItems] loadTasks completed')
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [])

  useEffect(() => {
    let disposed = false
    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    const unlistenFns: Array<() => void> = []

    const scheduleReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer)
      }

      reloadTimer = setTimeout(() => {
        reloadTimer = null
        void loadTasks()
      }, 300)
    }

    const bind = async () => {
      const messageIds = [
        'task-created',
        'task-updated',
        'task-deleted',
        'task-paused',
        'task-resumed',
        'task-executed',
        'workspace-changed',
      ] as const

      for (const messageId of messageIds) {
        const unlisten = await listen(messageId, (event) => {
          console.log('[useTasksSidebarItems] Received event:', formatForLog({ messageId, hasPayload: event.payload != null }))
          scheduleReload()
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
      if (reloadTimer) {
        clearTimeout(reloadTimer)
      }
      for (const fn of unlistenFns) {
        fn()
      }
    }
  }, [])

  const items = tasks.map((task) => ({
    id: task.id,
    label: task.name,
    description:
      task.type === 'scheduled'
        ? task.scheduleType === 'cron' && task.schedule
          ? convertCronToLocalTime(task.schedule)
          : task.schedule || '定时任务'
        : task.lastExecutionStatus === 'failure'
          ? '最近失败'
          : '手动执行',
    metaBadges: getTaskMetaBadges(task),
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
