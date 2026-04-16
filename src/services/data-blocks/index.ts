import { serviceMode } from '../runtime'
import { dataBlocksMockService } from './mock'
import { dataBlocksTauriService } from './tauri'

export type { DataBlockCardData, DataBlockLayoutItem, DataBlocksService } from './types'

export const dataBlocksService = serviceMode === 'tauri' ? dataBlocksTauriService : dataBlocksMockService
