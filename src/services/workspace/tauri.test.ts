import { describe, expect, it, vi } from 'vitest'

const tauriInvokeMock = vi.fn()

vi.mock('@/lib/tauri-api', () => ({
  tauriInvoke: tauriInvokeMock,
}))

describe('workspaceTauriService', () => {
  it('calls clear_current_workspace_command when clearing startup workspace state', async () => {
    const { workspaceTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await workspaceTauriService.clearCurrentWorkspace()

    expect(tauriInvokeMock).toHaveBeenCalledWith('clear_current_workspace_command')
  })

  it('maps get_current_workspace to the Tauri command', async () => {
    const { workspaceTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce('/tmp/workspace')

    await expect(workspaceTauriService.getCurrentWorkspace()).resolves.toBe('/tmp/workspace')
    expect(tauriInvokeMock).toHaveBeenCalledWith('get_current_workspace')
  })
})
