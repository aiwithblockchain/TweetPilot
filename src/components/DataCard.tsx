import { useState, useEffect } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { dataBlocksService } from '@/services'
import type { DataBlockCard } from '@/services/data-blocks'
import {
  BarChart,
  Bar,
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

function formatChartTime(value: unknown) {
  if (typeof value !== 'string' || !value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
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
      setData(null)
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
      account_current_metrics: '账号实时数据',
      followers_growth_trend: '粉丝增长趋势',
      account_activity_metrics: '账号活跃度',
      account_overview: '账号概览',
    }
    return titles[card.type] || '数据积木'
  }

  const getDeltaTextColor = (value: number) => {
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  const getSignedValue = (value: number) => {
    return `${value > 0 ? '+' : ''}${value}`
  }

  const getDisplayUpdatedAt = () => {
    if (data?.snapshotTime && typeof data.snapshotTime === 'string') {
      return data.snapshotTime
    }

    const trendPoints = Array.isArray(data?.data) ? data.data : []
    const latestTrendPoint = trendPoints[trendPoints.length - 1]
    if (latestTrendPoint?.time && typeof latestTrendPoint.time === 'string') {
      return latestTrendPoint.time
    }

    return card.lastUpdated
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
      case 'account_current_metrics':
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.followers || 0}</div>
              <div className="text-xs text-secondary mt-1">粉丝</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.following || 0}</div>
              <div className="text-xs text-secondary mt-1">关注</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.tweets || 0}</div>
              <div className="text-xs text-secondary mt-1">推文</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.favourites || 0}</div>
              <div className="text-xs text-secondary mt-1">点赞</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.listed || 0}</div>
              <div className="text-xs text-secondary mt-1">列表</div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded text-center">
              <div className="text-2xl font-semibold">{data.media || 0}</div>
              <div className="text-xs text-secondary mt-1">媒体</div>
            </div>
          </div>
        )

      case 'followers_growth_trend':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-secondary">过去 {data.hours || 24} 小时</div>
              <div className={`text-lg font-semibold ${getDeltaTextColor(data.growth || 0)}`}>
                {getSignedValue(data.growth || 0)}
              </div>
            </div>
            {data.data && data.data.length > 0 ? (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }}
                      stroke="var(--color-border)"
                      tickFormatter={formatChartTime}
                    />
                    <YAxis
                      tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }}
                      stroke="var(--color-border)"
                    />
                    <Tooltip
                      labelFormatter={formatChartTime}
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="followers" fill="#6D5BF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-xs text-secondary text-center py-8">暂无趋势数据</div>
            )}
          </div>
        )

      case 'account_activity_metrics':
        return (
          <div className="space-y-3">
            <div className="text-xs text-secondary mb-2">过去 {data.hours || 24} 小时变化</div>
            <div className="p-3 bg-[var(--color-bg)] rounded flex items-center justify-between">
              <div className="text-xs text-secondary">推文变化</div>
              <div className={`text-lg font-semibold ${getDeltaTextColor(data.tweetChange || 0)}`}>
                {getSignedValue(data.tweetChange || 0)}
              </div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded flex items-center justify-between">
              <div className="text-xs text-secondary">点赞变化</div>
              <div className={`text-lg font-semibold ${getDeltaTextColor(data.favouriteChange || 0)}`}>
                {getSignedValue(data.favouriteChange || 0)}
              </div>
            </div>
            <div className="p-3 bg-[var(--color-bg)] rounded flex items-center justify-between">
              <div className="text-xs text-secondary">媒体变化</div>
              <div className={`text-lg font-semibold ${getDeltaTextColor(data.mediaChange || 0)}`}>
                {getSignedValue(data.mediaChange || 0)}
              </div>
            </div>
          </div>
        )

      case 'account_overview':
        return (
          <div className="space-y-3">
            <div className="text-xs text-secondary mb-2">过去 {data.hours || 24} 小时概览</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[var(--color-bg)] rounded">
                <div className="text-xs text-secondary mb-1">粉丝</div>
                <div className="text-xl font-semibold">{data.current?.followers || 0}</div>
                <div className={`text-xs mt-1 ${getDeltaTextColor(data.changes?.followers || 0)}`}>
                  {getSignedValue(data.changes?.followers || 0)}
                </div>
              </div>
              <div className="p-3 bg-[var(--color-bg)] rounded">
                <div className="text-xs text-secondary mb-1">关注</div>
                <div className="text-xl font-semibold">{data.current?.following || 0}</div>
                <div className={`text-xs mt-1 ${getDeltaTextColor(data.changes?.following || 0)}`}>
                  {getSignedValue(data.changes?.following || 0)}
                </div>
              </div>
              <div className="p-3 bg-[var(--color-bg)] rounded">
                <div className="text-xs text-secondary mb-1">推文</div>
                <div className="text-xl font-semibold">{data.current?.tweets || 0}</div>
                <div className={`text-xs mt-1 ${getDeltaTextColor(data.changes?.tweets || 0)}`}>
                  {getSignedValue(data.changes?.tweets || 0)}
                </div>
              </div>
              <div className="p-3 bg-[var(--color-bg)] rounded">
                <div className="text-xs text-secondary mb-1">点赞</div>
                <div className="text-xl font-semibold">{data.current?.favourites || 0}</div>
                <div className={`text-xs mt-1 ${getDeltaTextColor(data.changes?.favourites || 0)}`}>
                  {getSignedValue(data.changes?.favourites || 0)}
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="text-sm text-secondary">未知积木类型</div>
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
            className="w-7 h-7 flex cursor-pointer items-center justify-center text-sm hover:bg-[var(--color-bg)] rounded transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 flex cursor-pointer items-center justify-center text-sm hover:bg-[var(--color-bg)] rounded transition-colors"
            title="删除"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3">{renderCardContent()}</div>

      <div className="px-3 py-2 border-t border-[var(--color-border)] text-xs text-secondary">
        最后更新: {formatRelativeTime(getDisplayUpdatedAt())}
      </div>
    </div>
  )
}
