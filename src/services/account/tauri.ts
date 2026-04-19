import { tauriInvoke } from '@/lib/tauri-api'
import type {
  AccountService,
  AccountSettings,
  AccountStatus,
  AvailableAccount,
  MappedAccount,
} from './types'

interface TauriAvailableAccount {
  screenName: string
  displayName: string
  avatar: string
}

interface TauriMappedAccount {
  screenName: string
  displayName: string
  avatar: string
  status: AccountStatus
  lastVerified: string
  twitterId?: string
  description?: string
  instanceId?: string
  extensionName?: string
  defaultTabId?: number
  isLoggedIn?: boolean
  followersCount?: number
  followingCount?: number
  tweetCount?: number
}

interface TauriAccountSettings {
  twitterId: string
  name: string
  screenName: string
  avatar: string
  isLinked: boolean
  extensionId?: string
  extensionName?: string
  personality: string
}

function mapTauriMappedAccount(account: TauriMappedAccount): MappedAccount {
  return {
    screenName: account.screenName,
    displayName: account.displayName,
    avatar: account.avatar,
    status: account.status,
    lastVerified: account.lastVerified,
    twitterId: account.twitterId,
    description: account.description,
    instanceId: account.instanceId,
    extensionName: account.extensionName,
    defaultTabId: account.defaultTabId,
    isLoggedIn: account.isLoggedIn,
    followersCount: account.followersCount,
    followingCount: account.followingCount,
    tweetCount: account.tweetCount,
  }
}

function mapTauriAvailableAccount(account: TauriAvailableAccount): AvailableAccount {
  return {
    screenName: account.screenName,
    displayName: account.displayName,
    avatar: account.avatar,
  }
}

function mapTauriAccountSettings(settings: TauriAccountSettings): AccountSettings {
  return {
    twitterId: settings.twitterId,
    name: settings.name,
    screenName: settings.screenName,
    avatar: settings.avatar,
    isLinked: settings.isLinked,
    extensionId: settings.extensionId,
    extensionName: settings.extensionName,
    personality: settings.personality,
  }
}

export const accountTauriService: AccountService = {
  async getAvailableAccounts() {
    const result = await tauriInvoke<TauriAvailableAccount[]>('get_available_accounts')
    return result.map(mapTauriAvailableAccount)
  },

  async getMappedAccounts() {
    const result = await tauriInvoke<TauriMappedAccount[]>('get_mapped_accounts')
    return result.map(mapTauriMappedAccount)
  },

  async mapAccount(screenName) {
    const result = await tauriInvoke<TauriMappedAccount>('map_account', { screenName })
    return mapTauriMappedAccount(result)
  },

  async deleteAccountMapping(screenName) {
    await tauriInvoke<void>('delete_account_mapping', { screenName })
  },

  async verifyAccountStatus(screenName) {
    return tauriInvoke<AccountStatus>('verify_account_status', { screenName })
  },

  async refreshAllAccountsStatus() {
    await tauriInvoke<void>('refresh_all_accounts_status')
  },

  async reconnectAccount(screenName) {
    await tauriInvoke<void>('reconnect_account', { screenName })
  },

  async getAccountSettings(screenName) {
    const result = await tauriInvoke<TauriAccountSettings>('get_account_settings', {
      screenName,
    })
    return mapTauriAccountSettings(result)
  },

  async saveAccountPersonality(screenName, personality) {
    await tauriInvoke<void>('save_account_personality', {
      screenName,
      personality,
    })
  },

  async unlinkAccount(screenName) {
    await tauriInvoke<void>('unlink_account', { screenName })
  },

  async deleteAccountCompletely(screenName) {
    await tauriInvoke<void>('delete_account_completely', { screenName })
  },
}
