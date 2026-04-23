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
    id: 'account_current_metrics',
    name: '账号实时数据',
    description: '显示账号的最新指标快照，包括粉丝、关注、推文等核心数据。',
    accent: '#6D5BF6',
    summary: '实时快照',
    category: 'analytics',
  },
  {
    id: 'followers_growth_trend',
    name: '粉丝增长趋势',
    description: '显示过去 N 小时的粉丝增长曲线，直观展示账号增长情况。',
    accent: '#4EC9B0',
    summary: '增长曲线',
    category: 'analytics',
  },
  {
    id: 'account_activity_metrics',
    name: '账号活跃度',
    description: '显示推文数、点赞数、媒体数等活跃度指标的变化情况。',
    accent: '#9CDCFE',
    summary: '活跃度分析',
    category: 'analytics',
  },
  {
    id: 'account_overview',
    name: '账号概览',
    description: '综合展示多个维度的数据对比，包括当前值和变化趋势。',
    accent: '#D7BA7D',
    summary: '综合概览',
    category: 'analytics',
  },
]

export const DATA_BLOCK_NAME_MAP = Object.fromEntries(DATA_BLOCK_CATALOG.map((item) => [item.id, item.name])) as Record<KnownDataBlockCardType, string>
