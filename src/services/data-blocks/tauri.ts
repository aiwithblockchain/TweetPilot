import { tauriInvoke } from '@/lib/tauri-api'
import type {
  DataBlockCard,
  DataBlockCardData,
  DataBlocksService,
} from './types'

interface TauriDataBlockCard {
  id: string
  type: string
  position: number
  config?: Record<string, unknown> | null
  lastUpdated: string
}

function mapTauriCard(card: TauriDataBlockCard): DataBlockCard {
  return {
    id: card.id,
    type: card.type,
    position: card.position,
    config: card.config ?? undefined,
    lastUpdated: card.lastUpdated,
  }
}

function mapCardToTauri(card: DataBlockCard): TauriDataBlockCard {
  return {
    id: card.id,
    type: card.type,
    position: card.position,
    config: card.config,
    lastUpdated: card.lastUpdated,
  }
}

export const dataBlocksTauriService: DataBlocksService = {
  async getLayout() {
    const response = await tauriInvoke<TauriDataBlockCard[]>('get_layout')
    return response.map(mapTauriCard)
  },

  async saveLayout(layout) {
    await tauriInvoke<void>('save_layout', {
      layout: layout.map(mapCardToTauri),
    })
  },

  async addCard(cardType, config) {
    const response = await tauriInvoke<TauriDataBlockCard>('add_card', {
      cardType,
      config,
    })
    return mapTauriCard(response)
  },

  async deleteCard(cardId) {
    await tauriInvoke<void>('delete_card', { cardId })
  },

  async getCardData(cardId, cardType, accountId) {
    return tauriInvoke<DataBlockCardData>('get_card_data', {
      cardId,
      cardType,
      accountId: accountId ?? null,
    })
  },

  async getBlockPreview(cardType, accountId) {
    return tauriInvoke<DataBlockCardData>('get_data_block_preview', {
      cardType,
      accountId: accountId ?? null,
    })
  },

  async refreshCardData(cardId) {
    await tauriInvoke<void>('refresh_card_data', { cardId })
  },
}
