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
        type: 'scheduled',
        script_path: '/scripts/sync.ts',
        schedule: '0 2 * * *',
        schedule_type: undefined,
        interval_seconds: undefined,
        parameters: {
          account: '@tweetpilot',
        },
        account_id: '',
      },
    })
  })
})
