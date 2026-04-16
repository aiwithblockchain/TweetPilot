import type { AppSettings, LocalBridgeConfig } from '../settings/types'

export const defaultSettings: AppSettings = {
  theme: 'dark',
  language: 'zh-CN',
}

export const defaultLocalBridgeConfig: LocalBridgeConfig = {
  endpoint: 'http://127.0.0.1:8000',
  apiKey: '',
  timeoutMs: 30000,
}
