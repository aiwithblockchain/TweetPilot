import { defaultLocalBridgeConfig, defaultSettings } from '../mock-data/settings'
import type { AppSettings, LocalBridgeConfig, SettingsService } from './types'

let appSettings: AppSettings = { ...defaultSettings }
let localBridgeConfig: LocalBridgeConfig = { ...defaultLocalBridgeConfig }

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function assertTheme(theme: string): asserts theme is AppSettings['theme'] {
  if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
    throw new Error('主题配置非法')
  }
}

function assertLanguage(language: string) {
  if (!language.trim()) {
    throw new Error('语言配置不能为空')
  }
}

function assertEndpoint(endpoint: string) {
  if (!endpoint.trim()) {
    throw new Error('LocalBridge 地址不能为空')
  }

  let parsed: URL
  try {
    parsed = new URL(endpoint)
  } catch {
    throw new Error('LocalBridge 地址格式非法')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('LocalBridge 地址协议非法')
  }
}

function assertTimeout(timeoutMs: number) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('LocalBridge 超时时间必须为正整数')
  }
}

export const settingsMockService: SettingsService = {
  async getSettings() {
    await randomDelay(50, 150)
    return { ...appSettings }
  },

  async updateSettings(settings) {
    await randomDelay(100, 250)

    assertTheme(settings.theme)
    assertLanguage(settings.language)

    appSettings = {
      ...settings,
      language: settings.language.trim(),
    }
  },

  async getLocalBridgeConfig() {
    await randomDelay(50, 150)
    return { ...localBridgeConfig }
  },

  async updateLocalBridgeConfig(config) {
    await randomDelay(100, 250)

    assertEndpoint(config.endpoint)
    assertTimeout(config.timeoutMs)

    localBridgeConfig = {
      ...config,
      endpoint: config.endpoint.trim(),
    }
  },

  async testLocalBridgeConnection() {
    await randomDelay(500, 1000)
    return Math.random() > 0.3
  },
}
