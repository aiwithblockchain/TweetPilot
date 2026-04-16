import { serviceMode } from '../runtime'
import { accountMockService } from './mock'
import { accountTauriService } from './tauri'

export type {
  AccountService,
  AccountSettings,
  AccountStatus,
  AvailableAccount,
  MappedAccount,
} from './types'

export const accountService = serviceMode === 'tauri' ? accountTauriService : accountMockService
