import type { AppSettings, LocalBridgeConfig } from '../settings/types'

export const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'zh-CN',
}

export const defaultLocalBridgeConfig: LocalBridgeConfig = {
  endpoint: 'http://127.0.0.1:10088',
  timeoutMs: 30000,
  syncIntervalMs: 60000,
}
