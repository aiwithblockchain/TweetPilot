import { describe, expect, it, vi } from 'vitest'

const tauriInvokeMock = vi.fn()

vi.mock('@/lib/tauri-api', () => ({
  tauriInvoke: tauriInvokeMock,
}))

describe('taskTauriService', () => {
  it('maps task config updates to snake_case command payloads', async () => {
    const { taskTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await taskTauriService.updateTask('task_123', {
      name: 'Nightly Sync',
      description: 'Sync tweets nightly',
      taskType: 'scheduled',
      scriptPath: '/scripts/sync.ts',
      schedule: '0 2 * * *',
      parameters: {
        account: '@tweetpilot',
      },
    })

    expect(tauriInvokeMock).toHaveBeenCalledWith('update_task', {
      taskId: 'task_123',
      config: {
        name: 'Nightly Sync',
        description: 'Sync tweets nightly',
        task_type: 'scheduled',
        script_path: '/scripts/sync.ts',
        schedule: '0 2 * * *',
        parameters: {
          account: '@tweetpilot',
        },
      },
    })
  })

  it('derives aggregate stats from mapped task statuses', async () => {
    const { taskTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce([
      {
        id: '1',
        name: 'Task 1',
        type: 'scheduled',
        scriptPath: '/scripts/1.ts',
        status: 'running',
      },
      {
        id: '2',
        name: 'Task 2',
        type: 'scheduled',
        scriptPath: '/scripts/2.ts',
        status: 'paused',
      },
      {
        id: '3',
        name: 'Task 3',
        type: 'immediate',
        scriptPath: '/scripts/3.ts',
        status: 'failed',
      },
      {
        id: '4',
        name: 'Task 4',
        type: 'immediate',
        scriptPath: '/scripts/4.ts',
        status: 'idle',
      },
    ])

    await expect(taskTauriService.getTaskStats()).resolves.toEqual({
      total: 4,
      running: 1,
      paused: 1,
      failed: 1,
    })
  })
})
