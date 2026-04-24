import { describe, expect, it, vi, beforeEach } from 'vitest'

const tauriInvokeMock = vi.fn()

vi.mock('@/lib/tauri-api', () => ({
  tauriInvoke: tauriInvokeMock,
}))

describe('workspaceTauriService', () => {
  beforeEach(() => {
    tauriInvokeMock.mockReset()
  })

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

  it('maps rename entry to the Tauri command', async () => {
    const { workspaceTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce({
      path: '/tmp/workspace/src/renamed.ts',
      name: 'renamed.ts',
      kind: 'file',
      extension: 'ts',
      size: 10,
      modified_at: null,
      has_children: false,
    })

    const result = await workspaceTauriService.renameEntry({
      path: '/tmp/workspace/src/original.ts',
      newName: 'renamed.ts',
    })

    expect(result.name).toBe('renamed.ts')
    expect(tauriInvokeMock).toHaveBeenCalledWith('rename_workspace_entry', {
      path: '/tmp/workspace/src/original.ts',
      newName: 'renamed.ts',
    })
  })

  it('maps delete entry to the Tauri command', async () => {
    const { workspaceTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await workspaceTauriService.deleteEntry('/tmp/workspace/src/original.ts')

    expect(tauriInvokeMock).toHaveBeenCalledWith('delete_workspace_entry', {
      path: '/tmp/workspace/src/original.ts',
    })
  })
})
