import type { KnownDataBlockCardType } from '@/services/data-blocks'

export interface DataBlockCatalogItem {
  id: KnownDataBlockCardType
  name: string
  description: string
  accent: string
  summary: string
  category: 'twitter' | 'analytics' | 'tasks'
}

export const DATA_BLOCK_CATALOG: DataBlockCatalogItem[] = [
  {
    id: 'latest_tweets',
    name: '最新推文列表',
    description: '显示账号最近的推文内容、时间和互动摘要。',
    accent: '#4EC9B0',
    summary: '内容流',
    category: 'twitter',
  },
  {
    id: 'account_basic_data',
    name: '粉丝统计',
    description: '展示关注、粉丝、推文数量等基础账号数据。',
    accent: '#6D5BF6',
    summary: '账号画像',
    category: 'analytics',
  },
  {
    id: 'account_interaction_data',
    name: '推文互动数据',
    description: '展示浏览量、点赞、转推等互动表现。',
    accent: '#9CDCFE',
    summary: '互动报表',
    category: 'analytics',
  },
  {
    id: 'tweet_time_distribution',
    name: '推文时间分布',
    description: '以报表形式展示最近周期内的发布时间分布。',
    accent: '#D7BA7D',
    summary: '发布时间报表',
    category: 'analytics',
  },
  {
    id: 'task_execution_stats',
    name: '任务执行统计',
    description: '展示最近任务的成功率与执行情况。',
    accent: '#F48771',
    summary: '任务报表',
    category: 'tasks',
  },
]

export const DATA_BLOCK_NAME_MAP = Object.fromEntries(DATA_BLOCK_CATALOG.map((item) => [item.id, item.name])) as Record<KnownDataBlockCardType, string>
