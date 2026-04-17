import { accountTauriService } from './tauri'

export type {
  AccountService,
  AccountSettings,
  AccountStatus,
  AvailableAccount,
  MappedAccount,
} from './types'

export const accountService = accountTauriService
