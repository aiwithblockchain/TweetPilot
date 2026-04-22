import { accountTauriService } from './tauri'

export type {
  AccountService,
  AvailableAccount,
  ManagedAccount,
} from './types'

export const accountService = accountTauriService
