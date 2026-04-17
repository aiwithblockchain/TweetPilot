import { tauriInvoke } from '@/lib/tauri-api'
import type { AppSettings, LocalBridgeConfig, SettingsService } from './types'

interface TauriPreferences {
  language: string
  theme: 'light' | 'dark' | 'system'
  startup?: string
}

interface TauriLocalBridgeConfig {
  endpoint: string
  timeout_ms: number
  sync_interval_ms: number
}

function mapPreferencesToAppSettings(preferences: TauriPreferences): AppSettings {
  return {
    language: preferences.language,
    theme: preferences.theme,
  }
}

function mapAppSettingsToPreferences(settings: AppSettings): TauriPreferences {
  return {
    language: settings.language,
    theme: settings.theme,
  }
}

function mapLocalBridgeConfig(config: TauriLocalBridgeConfig): LocalBridgeConfig {
  return {
    endpoint: config.endpoint,
    timeoutMs: config.timeout_ms,
    syncIntervalMs: config.sync_interval_ms,
  }
}

export const settingsTauriService: SettingsService = {
  async getSettings() {
    const response = await tauriInvoke<TauriPreferences>('get_preferences')
    return mapPreferencesToAppSettings(response)
  },

  async updateSettings(settings) {
    await tauriInvoke<void>('save_preferences', {
      preferences: mapAppSettingsToPreferences(settings),
    })
  },

  async getLocalBridgeConfig() {
    const response = await tauriInvoke<TauriLocalBridgeConfig>('get_local_bridge_config')
    return mapLocalBridgeConfig(response)
  },

  async updateLocalBridgeConfig(config) {
    await tauriInvoke<void>('update_local_bridge_config', {
      endpoint: config.endpoint,
      timeout_ms: config.timeoutMs,
      sync_interval_ms: config.syncIntervalMs,
    })
  },

  async testLocalBridgeConnection() {
    return tauriInvoke<boolean>('test_localbridge_connection')
  },
}
