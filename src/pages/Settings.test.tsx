import { beforeEach, describe, expect, it } from 'vitest'
import { settingsService } from '@/services'

// Integration test: verify settings service calls work end-to-end
describe('Settings service integration', () => {
  beforeEach(() => {
    // Tests run against mock service in test environment
  })

  it('loads settings and LocalBridge config on page initialization', async () => {
    // Simulate what the Settings page does on mount
    const settings = await settingsService.getSettings()
    const config = await settingsService.getLocalBridgeConfig()

    expect(settings).toBeDefined()
    expect(settings).toHaveProperty('theme')
    expect(settings).toHaveProperty('language')
    expect(config).toBeDefined()
  })

  it('persists theme preference changes', async () => {
    const updatedSettings = { theme: 'dark' as const, language: 'en-US' }

    // Simulate user changing theme
    await settingsService.updateSettings(updatedSettings)

    // Verify the change persisted
    const result = await settingsService.getSettings()
    expect(result.theme).toBe('dark')
  })

  it('validates and saves LocalBridge endpoint configuration', async () => {
    const config = {
      endpoint: 'http://localhost:9090',
      apiKey: 'new-key',
      timeoutMs: 5000,
    }

    // Simulate user updating LocalBridge config
    await settingsService.updateLocalBridgeConfig(config)

    // Verify the change persisted
    const result = await settingsService.getLocalBridgeConfig()
    expect(result.endpoint).toBe('http://localhost:9090')
  })
})
