import { tauriInvoke } from '@/lib/tauri-api'
import type {
  AccountService,
  AvailableAccount,
  ManagedAccount,
} from './types'

interface TauriAccountWithStatus {
  twitterId: string
  screenName: string
  displayName: string
  avatarUrl?: string
  description?: string
  isVerified: boolean
  isOnline: boolean
  lastOnlineTime?: string
  instanceId?: string
  extensionName?: string
}

function mapTauriAccount(account: TauriAccountWithStatus): ManagedAccount | AvailableAccount {
  return {
    twitterId: account.twitterId,
    screenName: account.screenName,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    description: account.description,
    isVerified: account.isVerified,
    isOnline: account.isOnline,
    lastOnlineTime: account.lastOnlineTime,
    instanceId: account.instanceId,
    extensionName: account.extensionName,
  }
}

export const accountTauriService: AccountService = {
  async getManagedAccounts() {
    const result = await tauriInvoke<TauriAccountWithStatus[]>('get_managed_accounts')
    return result.map(mapTauriAccount)
  },

  async getAvailableAccounts() {
    const result = await tauriInvoke<TauriAccountWithStatus[]>('get_available_accounts')
    return result.map(mapTauriAccount)
  },

  async addAccountToManagement(twitterId) {
    await tauriInvoke<void>('add_account_to_management', { twitterId })
  },

  async removeAccountFromManagement(twitterId) {
    await tauriInvoke<void>('remove_account_from_management', { twitterId })
  },

  async deleteAccountCompletely(twitterId) {
    await tauriInvoke<void>('delete_account_completely', { twitterId })
  },

  async refreshAllAccountsStatus() {
    await tauriInvoke<void>('refresh_all_accounts_status')
  },
}
