import {
  defaultAccountSettings,
  defaultAvailableAccounts,
  defaultMappedAccounts,
} from '../mock-data/accounts'
import type {
  AccountService,
  AccountSettings,
  AccountStatus,
  AvailableAccount,
  MappedAccount,
} from './types'

let availableAccounts: AvailableAccount[] = [...defaultAvailableAccounts]
let mappedAccounts: MappedAccount[] = [...defaultMappedAccounts]
let accountSettingsByScreenName: Record<string, AccountSettings> = { ...defaultAccountSettings }

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getMappedAccount(screenName: string): MappedAccount {
  const account = mappedAccounts.find((item) => item.screenName === screenName)
  if (!account) {
    throw new Error('账号不存在')
  }
  return account
}

function ensureSettingsForAccount(account: MappedAccount) {
  if (!accountSettingsByScreenName[account.screenName]) {
    accountSettingsByScreenName[account.screenName] = {
      twitterId: `${account.screenName.slice(1)}123456789`,
      name: account.displayName,
      screenName: account.screenName,
      avatar: account.avatar,
      isLinked: true,
      extensionId: 'ext_abc123',
      extensionName: 'LocalBridge Extension',
      personality: '',
    }
  }
}

export const accountMockService: AccountService = {
  async getAvailableAccounts() {
    await randomDelay(50, 150)

    const mappedScreenNames = new Set(mappedAccounts.map((item) => item.screenName))
    return availableAccounts.filter((item) => !mappedScreenNames.has(item.screenName))
  },

  async getMappedAccounts() {
    await randomDelay(50, 150)
    return [...mappedAccounts]
  },

  async mapAccount(screenName) {
    await randomDelay(100, 250)

    if (mappedAccounts.some((item) => item.screenName === screenName)) {
      throw new Error('账号已映射')
    }

    const account = availableAccounts.find((item) => item.screenName === screenName)
    if (!account) {
      throw new Error('账号不存在')
    }

    const mappedAccount: MappedAccount = {
      ...account,
      status: 'online',
      lastVerified: new Date().toISOString(),
    }

    mappedAccounts = [...mappedAccounts, mappedAccount]
    ensureSettingsForAccount(mappedAccount)
    return mappedAccount
  },

  async deleteAccountMapping(screenName) {
    await randomDelay(100, 250)

    if (!mappedAccounts.some((item) => item.screenName === screenName)) {
      throw new Error('账号不存在')
    }

    mappedAccounts = mappedAccounts.filter((item) => item.screenName !== screenName)
  },

  async verifyAccountStatus(screenName) {
    await randomDelay(300, 1500)

    const account = getMappedAccount(screenName)
    const statuses: AccountStatus[] = ['online', 'offline']
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const updatedAccount: MappedAccount = {
      ...account,
      status,
      lastVerified: new Date().toISOString(),
    }

    mappedAccounts = mappedAccounts.map((item) =>
      item.screenName === screenName ? updatedAccount : item
    )

    return status
  },

  async refreshAllAccountsStatus() {
    await randomDelay(300, 1500)

    const now = new Date().toISOString()
    mappedAccounts = mappedAccounts.map((item, index) => ({
      ...item,
      status: index % 2 === 0 ? 'online' : 'offline',
      lastVerified: now,
    }))
  },

  async reconnectAccount(screenName) {
    await randomDelay(100, 250)

    const account = getMappedAccount(screenName)
    mappedAccounts = mappedAccounts.map((item) =>
      item.screenName === screenName
        ? {
            ...account,
            status: 'online',
            lastVerified: new Date().toISOString(),
          }
        : item
    )
  },

  async getAccountSettings(screenName) {
    await randomDelay(50, 150)

    getMappedAccount(screenName)

    const settings = accountSettingsByScreenName[screenName]
    if (!settings) {
      throw new Error('账号不存在')
    }

    return { ...settings }
  },

  async saveAccountPersonality(screenName, personality) {
    await randomDelay(100, 250)

    const settings = accountSettingsByScreenName[screenName]
    if (!settings) {
      throw new Error('账号不存在')
    }

    accountSettingsByScreenName = {
      ...accountSettingsByScreenName,
      [screenName]: {
        ...settings,
        personality,
      },
    }
  },

  async unlinkAccount(screenName) {
    await randomDelay(100, 250)

    if (!mappedAccounts.some((item) => item.screenName === screenName)) {
      throw new Error('账号不存在')
    }

    mappedAccounts = mappedAccounts.filter((item) => item.screenName !== screenName)

    if (accountSettingsByScreenName[screenName]) {
      accountSettingsByScreenName = {
        ...accountSettingsByScreenName,
        [screenName]: {
          ...accountSettingsByScreenName[screenName],
          isLinked: false,
        },
      }
    }
  },

  async deleteAccountCompletely(screenName) {
    await randomDelay(100, 250)

    if (!mappedAccounts.some((item) => item.screenName === screenName)) {
      throw new Error('账号不存在')
    }

    mappedAccounts = mappedAccounts.filter((item) => item.screenName !== screenName)

    const { [screenName]: _deleted, ...restSettings } = accountSettingsByScreenName
    accountSettingsByScreenName = restSettings
  },
}
