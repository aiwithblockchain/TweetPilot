import { tauriInvoke } from '@/lib/tauri-api'
import type { AppSettings, LocalBridgeConfig, SettingsService } from './types'

interface TauriPreferences {
  language: string
  theme: 'light' | 'dark' | 'system'
  startup?: string
}

interface TauriLocalBridgeConfig {
  endpoint: string
  api_key: string
  timeout_ms: number
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
    apiKey: config.api_key,
    timeoutMs: config.timeout_ms,
  }
}

function mapLocalBridgeConfigToTauri(config: LocalBridgeConfig): TauriLocalBridgeConfig {
  return {
    endpoint: config.endpoint,
    api_key: config.apiKey,
    timeout_ms: config.timeoutMs,
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
      config: mapLocalBridgeConfigToTauri(config),
    })
  },
}
