export interface DataBlockLayoutItem {
  id: string
  type: string
  title: string
  order: number
}

export interface DataBlockCardData {
  title: string
  value: string
  updatedAt: string
}

export interface DataBlocksService {
  getLayout(): Promise<DataBlockLayoutItem[]>
  saveLayout(layout: DataBlockLayoutItem[]): Promise<void>
  addCard(type: string): Promise<void>
  deleteCard(cardId: string): Promise<void>
  getCardData(cardId: string, cardType: string): Promise<DataBlockCardData>
  refreshCardData(cardId: string): Promise<void>
}
