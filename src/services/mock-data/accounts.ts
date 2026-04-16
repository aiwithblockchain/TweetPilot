import type { AccountSettings, AvailableAccount, MappedAccount } from '../account/types'

export const defaultAvailableAccounts: AvailableAccount[] = [
  {
    screenName: '@elonmusk',
    displayName: 'Elon Musk',
    avatar: 'https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg',
  },
  {
    screenName: '@jack',
    displayName: 'Jack Dorsey',
    avatar: 'https://pbs.twimg.com/profile_images/1115644092329758721/AFjOr-K8_400x400.jpg',
  },
  {
    screenName: '@naval',
    displayName: 'Naval',
    avatar: 'https://pbs.twimg.com/profile_images/1469381207701483520/0ye3FdXq_400x400.jpg',
  },
]

export const defaultMappedAccounts: MappedAccount[] = [
  {
    screenName: '@testuser1',
    displayName: 'Test User 1',
    avatar: 'https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg',
    status: 'online',
    lastVerified: '2026-04-16T10:00:00.000Z',
  },
]

export const defaultAccountSettings: Record<string, AccountSettings> = {
  '@testuser1': {
    twitterId: 'testuser1123456789',
    name: 'Test User 1',
    screenName: '@testuser1',
    avatar: 'https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg',
    isLinked: true,
    extensionId: 'ext_abc123',
    extensionName: 'LocalBridge Extension',
    personality: '',
  },
}
