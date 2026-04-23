import {
  BarChart3,
  Clock3,
  MessageSquareText,
  Sparkles,
  Workflow,
  Users,
  UserPlus,
  MessageSquare,
  Heart,
  List,
  Image,
  TrendingUp,
  User,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
} from 'lucide-react'
import { DATA_BLOCK_CATALOG } from '@/config/data-blocks'
import type { SidebarItem } from '@/config/layout'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface DataBlockDetailPaneProps {
  item: SidebarItem | null
}

export function DataBlockDetailPane({ item }: DataBlockDetailPaneProps) {
  if (!item) {
    return <EmptyState title="数据积木" description="请先在左侧选择一个数据积木，或点击左上角 + 号新增积木。" />
  }

  const block = DATA_BLOCK_CATALOG.find((entry) => entry.id === item.id)

  return (
    <div className="p-6 space-y-5">
      <div
        className="rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
        style={{ background: `linear-gradient(135deg, ${block?.accent ?? '#6D5BF6'}26 0%, var(--color-surface) 48%, var(--color-bg) 100%)` }}
      >
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-[var(--color-text)]">
                <Sparkles className="w-3.5 h-3.5" />
                数据积木详情
              </div>
              <h2 className="text-2xl font-semibold text-white mt-4">{block?.name ?? item.label}</h2>
              <p className="text-sm text-[#D4D4D4] mt-2 leading-6 max-w-2xl">{block?.description ?? item.description}</p>
            </div>

            <div className="hidden md:flex w-20 h-20 rounded-2xl border border-white/10 bg-black/20 items-center justify-center shadow-inner">
              <Workflow className="w-9 h-9 text-white/80" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
            <HeroStat label="展示方式" value={block?.summary ?? '详情视图'} />
            <HeroStat label="类别" value={block?.category ?? 'analytics'} />
            <HeroStat label="数据源" value="x_account_trend 表" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-5">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-[var(--color-text)]">
            <BarChart3 className="w-4 h-4 text-[#9CDCFE]" />
            报表预览
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-4 min-h-[360px] overflow-hidden">
            {item.id === 'account_current_metrics' ? <AccountCurrentMetricsPreview /> : null}
            {item.id === 'followers_growth_trend' ? <FollowersGrowthTrendPreview /> : null}
            {item.id === 'account_activity_metrics' ? <AccountActivityMetricsPreview /> : null}
            {item.id === 'account_overview' ? <AccountOverviewPreview /> : null}
          </div>
        </section>

        <div className="space-y-5">
          <Panel title="积木摘要" icon={<MessageSquareText className="w-4 h-4 text-[#4EC9B0]" />}>
            <InfoGrid
              items={[
                { label: '名称', value: block?.name ?? item.label },
                { label: '类型', value: block?.summary ?? '详情视图' },
                { label: '适用场景', value: block?.description ?? item.description },
                { label: '数据粒度', value: '1 小时间隔历史数据' },
              ]}
            />
          </Panel>

          <Panel title="设计说明" icon={<Clock3 className="w-4 h-4 text-[#D7BA7D]" />}>
            <div className="text-sm text-[var(--color-text)] leading-7 space-y-3">
              <p>数据积木基于 x_account_trend 表的 1 小时间隔历史数据，提供趋势分析能力。</p>
              <p>每 5 分钟采集一次数据，每小时插入新记录，支持查看过去 24 小时、7 天、30 天的数据变化。</p>
            </div>
          </Panel>

          <Panel title="核心价值" icon={<Workflow className="w-4 h-4 text-[#9CDCFE]" />}>
            <div className="space-y-2 text-sm text-[var(--color-text)] leading-6">
              <div>• 历史趋势分析，而非单一快照</div>
              <div>• 多维度数据对比</div>
              <div>• 账号运营数据可视化</div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] px-4 py-3 shadow-inner">
      <div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-sm text-[var(--color-text)] mt-1 leading-6">{value}</div>
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactElement; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-[var(--color-text)]">
        {icon}
        {title}
      </div>
      {children}
    </section>
  )
}

function InfoGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] p-3">
          <div className="text-[11px] text-[var(--color-text-secondary)]">{item.label}</div>
          <div className="text-sm text-[var(--color-text)] mt-1 leading-6">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function AccountCurrentMetricsPreview() {
  const metrics = [
    { icon: Users, label: '粉丝', value: '1,567', color: '#6D5BF6' },
    { icon: UserPlus, label: '关注', value: '234', color: '#4EC9B0' },
    { icon: MessageSquare, label: '推文', value: '892', color: '#9CDCFE' },
    { icon: Heart, label: '点赞', value: '3,421', color: '#F48771' },
    { icon: List, label: '列表', value: '12', color: '#D7BA7D' },
    { icon: Image, label: '媒体', value: '456', color: '#CE9178' },
  ]

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--color-border)]">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6D5BF6] to-[#9CDCFE] flex items-center justify-center">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--color-text)]">@username</div>
          <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            已认证账号
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-col justify-between shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-2 mb-2">
              <metric.icon className="w-4 h-4" style={{ color: metric.color }} />
              <div className="text-xs text-[var(--color-text-secondary)]">{metric.label}</div>
            </div>
            <div className="text-2xl font-semibold text-[var(--color-text)]">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="text-xs text-[var(--color-text-secondary)] text-center pt-2 border-t border-[var(--color-border)]">
        最后更新: 2 分钟前
      </div>
    </div>
  )
}

function FollowersGrowthTrendPreview() {
  const data = [
    { time: '00:00', followers: 1520 },
    { time: '04:00', followers: 1528 },
    { time: '08:00', followers: 1535 },
    { time: '12:00', followers: 1548 },
    { time: '16:00', followers: 1556 },
    { time: '20:00', followers: 1567 },
  ]

  const growth = data[data.length - 1].followers - data[0].followers

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text)]">过去 24 小时粉丝增长</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1">每小时数据点</div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="text-lg font-semibold text-green-600">+{growth}</span>
        </div>
      </div>

      <div className="flex-1 min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6D5BF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6D5BF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
            <XAxis
              dataKey="time"
              stroke="var(--color-text-secondary)"
              style={{ fontSize: '11px' }}
            />
            <YAxis
              stroke="var(--color-text-secondary)"
              style={{ fontSize: '11px' }}
              domain={['dataMin - 10', 'dataMax + 10']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Area
              type="monotone"
              dataKey="followers"
              stroke="#6D5BF6"
              strokeWidth={2}
              fill="url(#colorFollowers)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AccountActivityMetricsPreview() {
  const metrics = [
    { icon: MessageSquare, label: '推文变化', value: 5, color: '#9CDCFE' },
    { icon: Heart, label: '点赞变化', value: 12, color: '#F48771' },
    { icon: Image, label: '媒体变化', value: 3, color: '#CE9178' },
  ]

  return (
    <div className="h-full flex flex-col gap-4">
      <div>
        <div className="text-sm font-semibold text-[var(--color-text)]">过去 24 小时活跃度</div>
        <div className="text-xs text-[var(--color-text-secondary)] mt-1">账号内容产出变化</div>
      </div>

      <div className="grid grid-cols-1 gap-3 flex-1">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${metric.color}20` }}>
                  <metric.icon className="w-5 h-5" style={{ color: metric.color }} />
                </div>
                <div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{metric.label}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-semibold text-[var(--color-text)]">{metric.value > 0 ? '+' : ''}{metric.value}</span>
                    {metric.value > 0 ? (
                      <ArrowUp className="w-4 h-4 text-green-600" />
                    ) : metric.value < 0 ? (
                      <ArrowDown className="w-4 h-4 text-red-600" />
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="h-12 w-24 rounded-lg bg-[var(--color-input)] flex items-end gap-1 p-2">
                {[40, 55, 45, 70, 60, 75, 85].map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${height}%`,
                      backgroundColor: metric.color,
                      opacity: 0.6 + (i * 0.05)
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccountOverviewPreview() {
  const stats = [
    { label: '粉丝', current: 1567, change: 47, icon: Users },
    { label: '关注', current: 234, change: 2, icon: UserPlus },
    { label: '推文', current: 892, change: 5, icon: MessageSquare },
    { label: '点赞', current: 3421, change: 12, icon: Heart },
  ]

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3 pb-3 border-b border-[var(--color-border)]">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#6D5BF6] to-[#9CDCFE] flex items-center justify-center">
          <User className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--color-text)]">账号综合概览</div>
          <div className="text-xs text-[var(--color-text-secondary)]">过去 24 小时数据对比</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-2 mb-3">
              <stat.icon className="w-4 h-4 text-[#6D5BF6]" />
              <div className="text-xs text-[var(--color-text-secondary)]">{stat.label}</div>
            </div>
            <div className="text-2xl font-semibold text-[var(--color-text)] mb-2">
              {stat.current.toLocaleString()}
            </div>
            <div className={`flex items-center gap-1 text-sm ${stat.change > 0 ? 'text-green-600' : stat.change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {stat.change > 0 ? (
                <ArrowUp className="w-3 h-3" />
              ) : stat.change < 0 ? (
                <ArrowDown className="w-3 h-3" />
              ) : null}
              <span>{stat.change > 0 ? '+' : ''}{stat.change}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-md text-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8">
        <div className="text-base font-semibold text-[var(--color-text)]">{title}</div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-3 leading-6">{description}</p>
      </div>
    </div>
  )
}
