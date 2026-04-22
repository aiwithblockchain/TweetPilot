export interface ManagedAccount {
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

export interface AvailableAccount {
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

export interface AccountService {
  getManagedAccounts(): Promise<ManagedAccount[]>
  getAvailableAccounts(): Promise<AvailableAccount[]>
  addAccountToManagement(twitterId: string): Promise<void>
  removeAccountFromManagement(twitterId: string): Promise<void>
  deleteAccountCompletely(twitterId: string): Promise<void>
  refreshAllAccountsStatus(): Promise<void>
}
