import { dataBlocksTauriService } from './tauri'

export type {
  DataBlockCard,
  DataBlockCardData,
  DataBlockCardType,
  DataBlocksService,
  KnownDataBlockCardType,
} from './types'

export const dataBlocksService = dataBlocksTauriService
