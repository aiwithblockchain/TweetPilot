export type AccountStatus = 'online' | 'offline' | 'verifying' | 'unknown'

export interface AvailableAccount {
  screenName: string
  displayName: string
  avatar: string
}

export interface MappedAccount {
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
}

export interface AccountSettings {
  twitterId: string
  name: string
  screenName: string
  avatar: string
  isLinked: boolean
  extensionId?: string
  extensionName?: string
  personality: string
}

export interface AccountService {
  getAvailableAccounts(): Promise<AvailableAccount[]>
  getMappedAccounts(): Promise<MappedAccount[]>
  mapAccount(screenName: string): Promise<MappedAccount>
  deleteAccountMapping(screenName: string): Promise<void>
  verifyAccountStatus(screenName: string): Promise<AccountStatus>
  refreshAllAccountsStatus(): Promise<void>
  reconnectAccount(screenName: string): Promise<void>
  getAccountSettings(screenName: string): Promise<AccountSettings>
  saveAccountPersonality(screenName: string, personality: string): Promise<void>
  unlinkAccount(screenName: string): Promise<void>
  deleteAccountCompletely(screenName: string): Promise<void>
}
