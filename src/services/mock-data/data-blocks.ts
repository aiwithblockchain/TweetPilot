import type { DataBlockCard, DataBlockCardData, KnownDataBlockCardType } from '../data-blocks/types'

const nowIso = new Date().toISOString()

export const defaultDataBlockLayout: DataBlockCard[] = [
  {
    id: 'card_1',
    type: 'account_basic_data',
    position: 0,
    config: {},
    lastUpdated: nowIso,
  },
  {
    id: 'card_2',
    type: 'latest_tweets',
    position: 1,
    config: {},
    lastUpdated: nowIso,
  },
]

export const defaultCardDataByType: Record<KnownDataBlockCardType, DataBlockCardData> = {
  latest_tweets: {
    tweets: [
      {
        time: '2小时前',
        text: '这是一条测试推文，展示最新推文列表功能。',
        likes: 42,
        retweets: 12,
      },
      {
        time: '5小时前',
        text: 'TweetPilot 开发进展顺利，UI 界面已经基本完成。',
        likes: 128,
        retweets: 34,
      },
      {
        time: '1天前',
        text: '今天学习了 Tauri 框架，感觉非常强大！',
        likes: 89,
        retweets: 23,
      },
    ],
  },
  account_basic_data: {
    following: 234,
    followers: 1567,
    tweets: 892,
    likes: 3421,
  },
  account_interaction_data: {
    totalViews: 45678,
    totalLikes: 3421,
    totalRetweets: 892,
  },
  tweet_time_distribution: {
    data: [
      { day: '周一', count: 12 },
      { day: '周二', count: 8 },
      { day: '周三', count: 15 },
      { day: '周四', count: 10 },
      { day: '周五', count: 18 },
      { day: '周六', count: 5 },
      { day: '周日', count: 7 },
    ],
  },
  task_execution_stats: {
    data: [
      { name: '成功', value: 85 },
      { name: '失败', value: 15 },
    ],
  },
}
