import { describe, expect, it, vi } from 'vitest'

const tauriInvokeMock = vi.fn()

vi.mock('@/lib/tauri-api', () => ({
  tauriInvoke: tauriInvokeMock,
}))

describe('dataBlocksTauriService', () => {
  it('maps nullable block config from Tauri to undefined in the UI layer', async () => {
    const { dataBlocksTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce([
      {
        id: 'card_1',
        type: 'account_current_metrics',
        position: 0,
        config: null,
        lastUpdated: '2026-04-16T12:00:00.000Z',
      },
    ])

    await expect(dataBlocksTauriService.getLayout()).resolves.toEqual([
      {
        id: 'card_1',
        type: 'account_current_metrics',
        position: 0,
        config: undefined,
        lastUpdated: '2026-04-16T12:00:00.000Z',
      },
    ])
  })

  it('passes reordered layouts back to Tauri unchanged except for field mapping', async () => {
    const { dataBlocksTauriService } = await import('./tauri')

    tauriInvokeMock.mockResolvedValueOnce(undefined)

    await dataBlocksTauriService.saveLayout([
      {
        id: 'card_2',
        type: 'account_overview',
        position: 1,
        config: { hours: 24 },
        lastUpdated: '2026-04-16T12:10:00.000Z',
      },
    ])

    expect(tauriInvokeMock).toHaveBeenCalledWith('save_layout', {
      layout: [
        {
          id: 'card_2',
          type: 'account_overview',
          position: 1,
          config: { hours: 24 },
          lastUpdated: '2026-04-16T12:10:00.000Z',
        },
      ],
    })
  })
})
