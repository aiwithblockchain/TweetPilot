import { describe, expect, it, vi } from 'vitest'

const tauriInvokeMock = vi.fn()

vi.mock('@/lib/tauri-api', () => ({
  tauriInvoke: tauriInvokeMock,
}))

describe('settingsTauriService', () => {
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

    expect(tauriInvokeMock).toHaveBeenCalledWith('update_localbridge_config', {
      endpoint: 'http://localhost:3000',
      timeoutMs: 30000,
      syncIntervalMs: 60000,
    })
  })
})
