import { defaultCardDataByType, defaultDataBlockLayout } from '../mock-data/data-blocks'
import type {
  DataBlockCard,
  DataBlockCardData,
  DataBlocksService,
  KnownDataBlockCardType,
} from './types'

let cards: DataBlockCard[] = [...defaultDataBlockLayout]

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cloneCard(card: DataBlockCard): DataBlockCard {
  return {
    ...card,
    config: card.config ? { ...card.config } : undefined,
  }
}

function cloneCardData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}

function getCardOrThrow(cardId: string): DataBlockCard {
  const card = cards.find((item) => item.id === cardId)
  if (!card) {
    throw new Error('卡片不存在')
  }
  return card
}

function getDefaultDataByType(cardType: string): DataBlockCardData {
  const typed = cardType as KnownDataBlockCardType
  const data = defaultCardDataByType[typed]
  if (!data) {
    return {}
  }
  return cloneCardData(data)
}

export const dataBlocksMockService: DataBlocksService = {
  async getLayout() {
    await randomDelay(50, 150)
    return cards
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(cloneCard)
  },

  async saveLayout(layout) {
    await randomDelay(100, 250)

    const ids = new Set(layout.map((item) => item.id))
    if (ids.size !== layout.length) {
      throw new Error('布局中存在重复卡片')
    }

    cards = layout.map((item, index) => ({
      ...item,
      position: index,
      config: item.config ? { ...item.config } : undefined,
    }))
  },

  async addCard(cardType, config) {
    await randomDelay(100, 250)

    if (!cardType.trim()) {
      throw new Error('卡片类型不能为空')
    }

    if (cards.some((item) => item.type === cardType)) {
      throw new Error('该卡片类型已存在')
    }

    const nextCard: DataBlockCard = {
      id: `card_${Date.now()}`,
      type: cardType,
      position: cards.length,
      config: config ? { ...config } : undefined,
      lastUpdated: new Date().toISOString(),
    }

    cards = [...cards, nextCard]
    return cloneCard(nextCard)
  },

  async deleteCard(cardId) {
    await randomDelay(100, 250)

    getCardOrThrow(cardId)

    cards = cards
      .filter((item) => item.id !== cardId)
      .map((item, index) => ({ ...item, position: index }))
  },

  async getCardData(cardId, cardType) {
    await randomDelay(50, 150)

    getCardOrThrow(cardId)

    const card = cards.find((item) => item.id === cardId)
    if (card?.type !== cardType) {
      throw new Error('卡片类型不匹配')
    }

    return getDefaultDataByType(cardType)
  },

  async refreshCardData(cardId) {
    await randomDelay(300, 1500)

    getCardOrThrow(cardId)

    const now = new Date().toISOString()
    cards = cards.map((item) =>
      item.id === cardId
        ? {
            ...item,
            lastUpdated: now,
          }
        : item
    )
  },
}
