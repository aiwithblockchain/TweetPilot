import { describe, expect, it, vi, beforeEach } from 'vitest'

const tauriInvokeMock = vi.fn()

vi.mock('@/lib/tauri-api', () => ({
  tauriInvoke: tauriInvokeMock,
}))

describe('account service', () => {
  beforeEach(() => {
    tauriInvokeMock.mockReset()
  })

  it('maps managed accounts response into renderer DTOs', async () => {
    const { getManagedAccounts } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce([
      {
        twitterId: '123',
        screenName: 'tweetpilot_main',
        displayName: 'TweetPilot Main',
        avatarUrl: 'https://example.com/a.png',
        instanceId: 'instance-1',
        extensionName: 'localbridge-main',
        isManaged: true,
        isOnline: true,
        personalityPrompt: 'be concise',
        latestSnapshotAt: '2026-04-23T12:00:00Z',
        source: 'managed-db',
      },
    ])

    await expect(getManagedAccounts()).resolves.toEqual([
      {
        twitterId: '123',
        screenName: 'tweetpilot_main',
        displayName: 'TweetPilot Main',
        avatarUrl: 'https://example.com/a.png',
        instanceId: 'instance-1',
        extensionName: 'localbridge-main',
        isManaged: true,
        isOnline: true,
        personalityPrompt: 'be concise',
        latestSnapshotAt: '2026-04-23T12:00:00Z',
        source: 'managed-db',
      },
    ])
    expect(tauriInvokeMock).toHaveBeenCalledWith('get_managed_accounts')
  })

  it('maps unmanaged online accounts to unmanaged-memory source', async () => {
    const { getUnmanagedOnlineAccounts } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce([
      {
        twitterId: '456',
        screenName: 'tweetpilot_probe',
        displayName: 'TweetPilot Probe',
        instanceId: 'instance-2',
        extensionName: 'localbridge-probe',
        isManaged: false,
        isOnline: true,
        source: 'unmanaged-memory',
      },
    ])

    await expect(getUnmanagedOnlineAccounts()).resolves.toEqual([
      {
        twitterId: '456',
        screenName: 'tweetpilot_probe',
        displayName: 'TweetPilot Probe',
        avatarUrl: undefined,
        instanceId: 'instance-2',
        extensionName: 'localbridge-probe',
        isManaged: false,
        isOnline: true,
        personalityPrompt: undefined,
        latestSnapshotAt: undefined,
        source: 'unmanaged-memory',
      },
    ])
    expect(tauriInvokeMock).toHaveBeenCalledWith('get_unmanaged_online_accounts')
  })

  it('passes update_account_personality_prompt payload with nullable prompt', async () => {
    const { updateAccountPersonalityPrompt } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await updateAccountPersonalityPrompt('123')

    expect(tauriInvokeMock).toHaveBeenCalledWith('update_account_personality_prompt', {
      twitterId: '123',
      personalityPrompt: null,
    })
  })
})
