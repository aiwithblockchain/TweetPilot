import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dataBlocksService } from '@/services'
import type { DataBlockCard } from '@/services'

vi.mock('@/lib/tauri-api', () => ({
  tauriInvoke: vi.fn(),
}))

const { tauriInvoke: tauriInvokeMock } = await import('@/lib/tauri-api')

const sampleLayout: DataBlockCard[] = [
  {
    id: 'card_1',
    type: 'account_current_metrics',
    position: 0,
    config: undefined,
    lastUpdated: '2026-04-24T10:00:00.000Z',
  },
  {
    id: 'card_2',
    type: 'account_overview',
    position: 1,
    config: { hours: 24 },
    lastUpdated: '2026-04-24T10:05:00.000Z',
  },
]

// Integration test: verify data blocks service operations work end-to-end
describe('DataBlocks service integration', () => {
  beforeEach(() => {
    tauriInvokeMock.mockReset()
  })

  it('loads block layout on page initialization', async () => {
    tauriInvokeMock.mockResolvedValueOnce(sampleLayout)

    const layout = await dataBlocksService.getLayout()

    expect(Array.isArray(layout)).toBe(true)
    layout.forEach((block: DataBlockCard) => {
      expect(block).toHaveProperty('id')
      expect(block).toHaveProperty('type')
      expect(block).toHaveProperty('position')
      expect(block).toHaveProperty('lastUpdated')
    })
    expect(tauriInvokeMock).toHaveBeenCalledWith('get_layout')
  })

  it('refreshes a single block and reloads layout', async () => {
    tauriInvokeMock
      .mockResolvedValueOnce(sampleLayout)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(sampleLayout)

    const layout = await dataBlocksService.getLayout()

    if (layout.length > 0) {
      const blockId = layout[0].id

      await dataBlocksService.refreshCardData(blockId)

      const updatedLayout = await dataBlocksService.getLayout()
      expect(Array.isArray(updatedLayout)).toBe(true)
      expect(tauriInvokeMock).toHaveBeenNthCalledWith(2, 'refresh_card_data', { cardId: blockId })
      expect(tauriInvokeMock).toHaveBeenNthCalledWith(3, 'get_layout')
    }
  })

  it('persists reordered block layout', async () => {
    tauriInvokeMock
      .mockResolvedValueOnce(sampleLayout)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([...sampleLayout].reverse())

    const originalLayout = await dataBlocksService.getLayout()

    const reorderedLayout = originalLayout.map((block: DataBlockCard, index: number) => ({
      ...block,
      position: originalLayout.length - 1 - index,
    }))

    await dataBlocksService.saveLayout(reorderedLayout)

    const savedLayout = await dataBlocksService.getLayout()
    expect(savedLayout.length).toBe(originalLayout.length)
    expect(tauriInvokeMock).toHaveBeenNthCalledWith(2, 'save_layout', { layout: reorderedLayout })
  })
})
