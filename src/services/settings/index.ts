import { serviceMode } from '../runtime'
import { settingsMockService } from './mock'
import { settingsTauriService } from './tauri'

export type { AppSettings, LocalBridgeConfig, SettingsService } from './types'

export const settingsService = serviceMode === 'tauri' ? settingsTauriService : settingsMockService
