export type KnownDataBlockCardType =
  | 'latest_tweets'
  | 'account_basic_data'
  | 'account_interaction_data'
  | 'tweet_time_distribution'
  | 'task_execution_stats'

export type DataBlockCardType = KnownDataBlockCardType | (string & {})

export interface DataBlockCard {
  id: string
  type: DataBlockCardType
  position: number
  config?: Record<string, unknown>
  lastUpdated: string
}

export type DataBlockCardData = Record<string, unknown>

export interface DataBlocksService {
  getLayout(): Promise<DataBlockCard[]>
  saveLayout(layout: DataBlockCard[]): Promise<void>
  addCard(cardType: DataBlockCardType, config?: Record<string, unknown>): Promise<DataBlockCard>
  deleteCard(cardId: string): Promise<void>
  getCardData(cardId: string, cardType: DataBlockCardType, accountId?: string | null): Promise<DataBlockCardData>
  refreshCardData(cardId: string): Promise<void>
}
