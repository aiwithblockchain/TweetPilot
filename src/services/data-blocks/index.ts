import { serviceMode } from '../runtime'
import { dataBlocksMockService } from './mock'
import { dataBlocksTauriService } from './tauri'

export type {
  DataBlockCard,
  DataBlockCardData,
  DataBlockCardType,
  DataBlocksService,
  KnownDataBlockCardType,
} from './types'

export const dataBlocksService = serviceMode === 'tauri' ? dataBlocksTauriService : dataBlocksMockService
