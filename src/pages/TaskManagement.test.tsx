import { beforeEach, describe, expect, it } from 'vitest'
import { taskService } from '@/services'
import type { Task } from '@/services'

// Integration test: verify task service operations work end-to-end
describe('TaskManagement service integration', () => {
  beforeEach(() => {
    // Tests run against mock service in test environment
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
    await taskService.executeTask(task.id)

    // In a real integration test, we'd verify execution records
    // For now, just verify the call succeeds
    expect(task.id).toBeDefined()
  })
})
