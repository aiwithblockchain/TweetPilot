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

  it('maps delete recent workspace to the Tauri command', async () => {
    const { workspaceTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await workspaceTauriService.deleteRecentWorkspace('/tmp/workspace')

    expect(tauriInvokeMock).toHaveBeenCalledWith('delete_recent_workspace', {
      path: '/tmp/workspace',
    })
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

  it('maps workspace watcher commands to Tauri commands', async () => {
    const { workspaceTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)
    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await workspaceTauriService.startWorkspaceWatcher('/tmp/workspace')
    await workspaceTauriService.stopWorkspaceWatcher()

    expect(tauriInvokeMock).toHaveBeenNthCalledWith(1, 'start_workspace_watcher', {
      path: '/tmp/workspace',
    })
    expect(tauriInvokeMock).toHaveBeenNthCalledWith(2, 'stop_workspace_watcher')
  })

  it('does not expose open workspace in new window on the frontend service boundary', async () => {
    const { workspaceTauriService } = await import('./tauri')

    expect('openWorkspaceInNewWindow' in workspaceTauriService).toBe(false)
  })
})
