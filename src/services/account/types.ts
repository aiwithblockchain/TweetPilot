// Basic types for LocalBridge integration
export interface LocalBridgeInstance {
  instanceId: string
  instanceName: string
}

export interface TwitterBasicInfo {
  id?: string
  screenName?: string
  name?: string
  profileImageUrl?: string
  description?: string
}

export type AccountSource = 'managed-db' | 'unmanaged-memory'

export interface AccountListItem {
  twitterId: string
  screenName: string
  displayName: string
  avatarUrl?: string
  instanceId?: string
  extensionName?: string
  isManaged: boolean
  isOnline: boolean
  personalityPrompt?: string
  latestSnapshotAt?: string
  source: AccountSource
}

export interface AccountLatestTrend {
  screenName: string
  displayName: string
  avatarUrl?: string
  description?: string
  followersCount?: number
  followingCount?: number
  tweetCount?: number
  favouritesCount?: number
  listedCount?: number
  mediaCount?: number
  accountCreatedAt?: string
  lastOnlineTime?: string
  createdAt?: string
}

export interface AccountDetail {
  account: {
    twitterId: string
    isManaged: boolean
    managedAt?: string
    unmanagedAt?: string
    instanceId?: string
    extensionName?: string
    personalityPrompt?: string
    createdAt?: string
    updatedAt?: string
    source: AccountSource
  }
  latestTrend: AccountLatestTrend | null
}

export interface ManagedAccountForTask {
  twitterId: string
  screenName?: string
  displayName?: string
  avatarUrl?: string
  personalityPrompt?: string
}
