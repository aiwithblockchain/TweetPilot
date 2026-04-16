export interface LocalBridgeConfig {
  endpoint: string
  apiKey: string
  timeoutMs: number
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: string
}

export interface SettingsService {
  getSettings(): Promise<AppSettings>
  updateSettings(settings: AppSettings): Promise<void>
  getLocalBridgeConfig(): Promise<LocalBridgeConfig>
  updateLocalBridgeConfig(config: LocalBridgeConfig): Promise<void>
}
