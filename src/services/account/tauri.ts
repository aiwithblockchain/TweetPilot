import { tauriInvoke } from '@/lib/tauri-api'
import type { AccountDetail, AccountListItem, LocalBridgeInstance, ManagedAccountForTask } from './types'

interface TauriAccountListItem {
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
  source: 'managed-db' | 'unmanaged-memory'
}

function mapAccountListItem(item: TauriAccountListItem): AccountListItem {
  return {
    twitterId: item.twitterId,
    screenName: item.screenName,
    displayName: item.displayName,
    avatarUrl: item.avatarUrl,
    instanceId: item.instanceId,
    extensionName: item.extensionName,
    isManaged: item.isManaged,
    isOnline: item.isOnline,
    personalityPrompt: item.personalityPrompt,
    latestSnapshotAt: item.latestSnapshotAt,
    source: item.source,
  }
}

export async function getInstances(): Promise<LocalBridgeInstance[]> {
  return tauriInvoke<LocalBridgeInstance[]>('get_instances')
}

export async function getManagedAccounts(): Promise<AccountListItem[]> {
  const response = await tauriInvoke<TauriAccountListItem[]>('get_managed_accounts')
  return response.map(mapAccountListItem)
}

export async function getUnmanagedOnlineAccounts(): Promise<AccountListItem[]> {
  const response = await tauriInvoke<TauriAccountListItem[]>('get_unmanaged_online_accounts')
  return response.map(mapAccountListItem)
}

export async function getAccountDetail(twitterId: string): Promise<AccountDetail> {
  return tauriInvoke<AccountDetail>('get_account_detail', { twitterId })
}

export async function addAccountToManagement(twitterId: string): Promise<void> {
  await tauriInvoke('add_account_to_management', { twitterId })
}

export async function removeAccountFromManagement(twitterId: string): Promise<void> {
  await tauriInvoke('remove_account_from_management', { twitterId })
}

export async function updateAccountPersonalityPrompt(twitterId: string, personalityPrompt?: string): Promise<void> {
  await tauriInvoke('update_account_personality_prompt', { twitterId, personalityPrompt: personalityPrompt ?? null })
}

export async function deleteAccountCompletely(twitterId: string): Promise<void> {
  await tauriInvoke('delete_account_completely', { twitterId })
}

export async function getManagedAccountsForTaskSelection(): Promise<ManagedAccountForTask[]> {
  return tauriInvoke<ManagedAccountForTask[]>('get_managed_accounts_for_task_selection')
}
