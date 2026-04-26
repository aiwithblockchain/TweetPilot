import { describe, expect, it, vi, beforeEach } from 'vitest'

const tauriInvokeMock = vi.fn()

vi.mock('@/lib/tauri-api', () => ({
  tauriInvoke: tauriInvokeMock,
}))

describe('settingsTauriService', () => {
  beforeEach(() => {
    tauriInvokeMock.mockReset()
  })

  it('maps preferences to app settings', async () => {
    const { settingsTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce({
      language: 'zh-CN',
      theme: 'dark',
      startup: 'workspace-selector',
    })

    await expect(settingsTauriService.getSettings()).resolves.toEqual({
      language: 'zh-CN',
      theme: 'dark',
    })
  })

  it('preserves startup when updating settings', async () => {
    const { settingsTauriService } = await import('./tauri')

    tauriInvokeMock
      .mockResolvedValueOnce({
        language: 'zh-CN',
        theme: 'dark',
        startup: 'workspace-selector',
      })
      .mockResolvedValueOnce(undefined)

    await settingsTauriService.updateSettings({
      language: 'en-US',
      theme: 'light',
    })

    expect(tauriInvokeMock).toHaveBeenNthCalledWith(1, 'get_preferences')
    expect(tauriInvokeMock).toHaveBeenNthCalledWith(2, 'save_preferences', {
      preferences: {
        language: 'en-US',
        theme: 'light',
        startup: 'workspace-selector',
      },
    })
  })

  it('maps local bridge config from snake_case to camelCase', async () => {
    const { settingsTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce({
      endpoint: 'http://127.0.0.1:8787',
      timeout_ms: 15000,
      sync_interval_ms: 60000,
    })

    await expect(settingsTauriService.getLocalBridgeConfig()).resolves.toEqual({
      endpoint: 'http://127.0.0.1:8787',
      timeoutMs: 15000,
      syncIntervalMs: 60000,
    })
  })

  it('maps local bridge config updates from camelCase to snake_case', async () => {
    const { settingsTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await settingsTauriService.updateLocalBridgeConfig({
      endpoint: 'http://localhost:3000',
      timeoutMs: 30000,
      syncIntervalMs: 60000,
    })

    expect(tauriInvokeMock).toHaveBeenCalledWith('update_local_bridge_config', {
      config: {
        endpoint: 'http://localhost:3000',
        timeout_ms: 30000,
        sync_interval_ms: 60000,
      },
    })
  })
})
