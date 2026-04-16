import { useState, useEffect } from 'react'
import { dataBlocksService } from '@/services'
import type { DataBlockCard } from '@/services/data-blocks'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DataCardProps {
  card: DataBlockCard
  selectedAccount: string | null
  onRefresh: () => void
  onDelete: () => void
}

export default function DataCard({ card, selectedAccount, onRefresh, onDelete }: DataCardProps) {
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadCardData()
  }, [card.id, card.type, selectedAccount])

  const loadCardData = async () => {
    setLoading(true)
    try {
      const result = await dataBlocksService.getCardData(card.id, card.type, selectedAccount)
      setData(result as Record<string, any>)
    } catch (error) {
      console.error('Failed to load card data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins} 分钟前`
    if (diffHours < 24) return `${diffHours} 小时前`
    return date.toLocaleDateString('zh-CN')
  }

  const getCardTitle = () => {
    const titles: Record<string, string> = {
      latest_tweets: '最新推文列表',
      account_basic_data: '粉丝统计',
      account_interaction_data: '推文互动数据',
      tweet_time_distribution: '推文时间分布',
      task_execution_stats: '任务执行统计',
    }
    return titles[card.type] || '数据卡片'
  }

  const renderCardContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-sm text-secondary">加载中...</div>
        </div>
      )
    }

    if (!data) {
      return (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-sm text-secondary">暂无数据</div>
        </div>
      )
    }

    switch (card.type) {
      case 'latest_tweets':
        return (
          <div className="space-y-2">
            {data.tweets?.slice(0, 5).map((tweet: any, index: number) => (
              <div key={index} className="p-2 bg-[var(--color-bg)] rounded text-xs">
                <div className="text-secondary mb-1">{tweet.time}</div>
                <div className="line-clamp-2">{tweet.text}</div>
                <div className="flex gap-3 mt-1 text-secondary">
                  <span>❤️ {tweet.likes}</span>
                  <span>🔁 {tweet.retweets}</span>
                </div>
              </div>
            ))}
          </div>
        )

      case 'account_basic_data':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.following || 0}</div>
              <div className="text-xs text-secondary mt-1">关注</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.followers || 0}</div>
              <div className="text-xs text-secondary mt-1">粉丝</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.tweets || 0}</div>
              <div className="text-xs text-secondary mt-1">推文</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.likes || 0}</div>
              <div className="text-xs text-secondary mt-1">喜欢</div>
            </div>
          </div>
        )

      case 'account_interaction_data':
        return (
          <div className="space-y-3">
            <div className="p-3 bg-[var(--color-bg)] rounded">
              <div className="text-xs text-secondary mb-1">总浏览量</div>
              <div className="text-xl font-semibold">{data.totalViews || 0}</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded">
              <div className="text-xs text-secondary mb-1">总点赞数</div>
              <div className="text-xl font-semibold">{data.totalLikes || 0}</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded">
              <div className="text-xs text-secondary mb-1">总转推数</div>
              <div className="text-xl font-semibold">{data.totalRetweets || 0}</div>
            </div>
          </div>
        )

      case 'tweet_time_distribution':
        return (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                  stroke="var(--color-border)"
                />
                <YAxis
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                  stroke="var(--color-border)"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#6D5BF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )

      case 'task_execution_stats':
        return (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.data?.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#6D5BF6' : '#EF4444'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )

      default:
        return (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-sm text-secondary">未知卡片类型</div>
          </div>
        )
    }
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden hover:border-[#6D5BF6] hover:shadow-sm transition-all">
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <div className="text-sm font-semibold">{getCardTitle()}</div>
        <div className="flex gap-1">
          <button
            onClick={onRefresh}
            className="w-7 h-7 flex items-center justify-center text-sm hover:bg-[var(--color-bg)] rounded transition-colors"
            title="刷新"
          >
            🔄
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center text-sm hover:bg-[var(--color-bg)] rounded transition-colors"
            title="删除"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-3">{renderCardContent()}</div>

      <div className="px-3 py-2 border-t border-[var(--color-border)] text-xs text-secondary">
        最后更新: {formatRelativeTime(card.lastUpdated)}
      </div>
    </div>
  )
}
