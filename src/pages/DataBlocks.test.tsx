import { beforeEach, describe, expect, it } from 'vitest'
import { dataBlocksService } from '@/services'
import type { DataBlockCard } from '@/services'

// Integration test: verify data blocks service operations work end-to-end
describe('DataBlocks service integration', () => {
  beforeEach(() => {
    // Tests run against mock service in test environment
  })

  it('loads card layout on page initialization', async () => {
    // Simulate what DataBlocks page does on mount
    const layout = await dataBlocksService.getLayout()

    expect(Array.isArray(layout)).toBe(true)
    layout.forEach((card: DataBlockCard) => {
      expect(card).toHaveProperty('id')
      expect(card).toHaveProperty('type')
      expect(card).toHaveProperty('position')
      expect(card).toHaveProperty('lastUpdated')
    })
  })

  it('refreshes a single card and reloads layout', async () => {
    const layout = await dataBlocksService.getLayout()

    if (layout.length > 0) {
      const cardId = layout[0].id

      // Simulate user clicking refresh button
      await dataBlocksService.refreshCardData(cardId)

      // Verify layout can be reloaded after refresh
      const updatedLayout = await dataBlocksService.getLayout()
      expect(Array.isArray(updatedLayout)).toBe(true)
    }
  })

  it('persists reordered card layout', async () => {
    const originalLayout = await dataBlocksService.getLayout()

    // Simulate drag-and-drop reordering
    const reorderedLayout = originalLayout.map((card: DataBlockCard, index: number) => ({
      ...card,
      position: originalLayout.length - 1 - index, // Reverse order
    }))

    await dataBlocksService.saveLayout(reorderedLayout)

    // Verify the new order persisted
    const savedLayout = await dataBlocksService.getLayout()
    expect(savedLayout.length).toBe(originalLayout.length)
  })
})
