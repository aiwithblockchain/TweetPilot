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
      api_key: 'secret-key',
      timeout_ms: 15000,
    })

    await expect(settingsTauriService.getLocalBridgeConfig()).resolves.toEqual({
      endpoint: 'http://127.0.0.1:8787',
      apiKey: 'secret-key',
      timeoutMs: 15000,
    })
  })

  it('maps local bridge config updates from camelCase to snake_case', async () => {
    const { settingsTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await settingsTauriService.updateLocalBridgeConfig({
      endpoint: 'http://localhost:3000',
      apiKey: 'bridge-token',
      timeoutMs: 30000,
    })

    expect(tauriInvokeMock).toHaveBeenCalledWith('update_local_bridge_config', {
      config: {
        endpoint: 'http://localhost:3000',
        api_key: 'bridge-token',
        timeout_ms: 30000,
      },
    })
  })
})
