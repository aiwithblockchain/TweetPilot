import { beforeEach, describe, expect, it, vi } from 'vitest'
import { taskService } from '@/services'
import type { Task } from '@/services'

const taskStore: Task[] = []
const executionStore = new Map<string, number>()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (command: string, args?: Record<string, any>) => {
    switch (command) {
      case 'get_tasks':
        return taskStore
      case 'create_task': {
        const config = (args?.config ?? {}) as Record<string, any>
        const now = new Date().toISOString()
        const createdTask: Task = {
          id: `task-${taskStore.length + 1}`,
          name: config.name ?? '',
          description: config.description,
          type: config.type ?? 'immediate',
          status: 'idle',
          enabled: true,
          executionMode: config.execution_mode ?? 'script',
          usePersona: config.use_persona ?? false,
          personaPrompt: config.persona_prompt,
          scriptPath: config.script_path ?? '',
          parameters: config.parameters ?? {},
          schedule: config.schedule,
          scheduleType: config.schedule_type ?? 'cron',
          intervalSeconds: config.interval_seconds,
          accountId: config.account_id ?? '',
          accountScreenName: undefined,
          statistics: {
            totalExecutions: 0,
            successCount: 0,
            failureCount: 0,
            successRate: 0,
            averageDuration: 0,
          },
          createdAt: now,
          updatedAt: now,
          timeout: config.timeout,
          retryCount: config.retry_count,
          retryDelay: config.retry_delay,
          tags: config.tags ?? [],
        }
        taskStore.push(createdTask)
        return createdTask
      }
      case 'execute_task': {
        const taskId = args?.taskId as string
        const task = taskStore.find(item => item.id === taskId)
        if (!task) {
          throw new Error(`Task not found: ${taskId}`)
        }
        const executions = (executionStore.get(taskId) ?? 0) + 1
        executionStore.set(taskId, executions)
        task.statistics.totalExecutions = executions
        task.statistics.successCount = executions
        task.statistics.successRate = 100
        task.lastExecutionStatus = 'success'
        task.lastExecutionTime = new Date().toISOString()

        return {
          id: `exec-${taskId}-${executions}`,
          taskId,
          runNo: executions,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: 1,
          status: 'success',
          exitCode: 0,
          stdout: 'ok',
          stderr: '',
          finalOutput: 'ok',
          errorMessage: null,
          metadata: null,
        }
      }
      default:
        throw new Error(`Unhandled invoke command in test: ${command}`)
    }
  }),
}))

// Integration test: verify task service operations work end-to-end
describe('TaskManagement service integration', () => {
  beforeEach(() => {
    taskStore.length = 0
    executionStore.clear()
  })

  it('loads task list', async () => {
    // Simulate what TaskManagement page does on mount
    const tasks = await taskService.getTasks()

    expect(Array.isArray(tasks)).toBe(true)
  })

  it('creates a new task and retrieves it', async () => {
    const newTask = {
      name: 'Test Task',
      description: 'Integration test task',
      taskType: 'immediate' as const,
      scriptPath: '/scripts/test.ts',
    }

    // Create task
    const createdTask = await taskService.createTask(newTask)
    expect(createdTask).toBeDefined()
    expect(createdTask.id).toBeDefined()

    // Verify it appears in the list
    const tasks = await taskService.getTasks()
    const found = tasks.find((t: Task) => t.id === createdTask.id)
    expect(found?.name).toBe('Test Task')
  })

  it('executes a task and tracks execution', async () => {
    const tasks = await taskService.getTasks()
    if (tasks.length === 0) {
      // Create a task first
      await taskService.createTask({
        name: 'Executable Task',
        taskType: 'immediate' as const,
        scriptPath: '/scripts/exec.ts',
      })
    }

    const task = (await taskService.getTasks())[0]

    // Execute the task
    const result = await taskService.executeTask(task.id)

    expect(result.status).toBe('success')
    expect(result.taskId).toBe(task.id)

    const updatedTask = (await taskService.getTasks())[0]
    expect(updatedTask.statistics.totalExecutions).toBe(1)
    expect(updatedTask.lastExecutionStatus).toBe('success')
  })
})
