import {
  BarChart3,
  Clock3,
  MessageSquareText,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { DATA_BLOCK_CATALOG } from '@/config/data-blocks'
import type { SidebarItem } from '@/config/layout'

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
        className="rounded-2xl border border-[#2A2A2A] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
        style={{ background: `linear-gradient(135deg, ${block?.accent ?? '#6D5BF6'}26 0%, #252526 48%, #171718 100%)` }}
      >
        <div className="p-6 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-[#CCCCCC]">
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
            <HeroStat label="状态" value="已迁移到左侧列表 + 主区详情" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-5">
        <section className="rounded-xl border border-[#2A2A2A] bg-[#252526] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-[#CCCCCC]">
            <BarChart3 className="w-4 h-4 text-[#9CDCFE]" />
            报表预览
          </div>

          <div className="rounded-xl border border-[#2A2A2A] bg-[#151516] p-4 min-h-[360px] overflow-hidden">
            {item.id === 'tweet_time_distribution' ? <TimeDistributionPreview /> : null}
            {item.id === 'account_interaction_data' ? <InteractionPreview /> : null}
            {item.id === 'account_basic_data' ? <AccountStatsPreview /> : null}
            {item.id === 'latest_tweets' ? <LatestTweetsPreview /> : null}
            {item.id === 'task_execution_stats' ? <TaskStatsPreview /> : null}
          </div>
        </section>

        <div className="space-y-5">
          <Panel title="积木摘要" icon={<MessageSquareText className="w-4 h-4 text-[#4EC9B0]" />}>
            <InfoGrid
              items={[
                { label: '名称', value: block?.name ?? item.label },
                { label: '类型', value: block?.summary ?? '详情视图' },
                { label: '适用场景', value: block?.description ?? item.description },
                { label: '交互模式', value: '左侧选择，中间丰富展示' },
              ]}
            />
          </Panel>

          <Panel title="设计说明" icon={<Clock3 className="w-4 h-4 text-[#D7BA7D]" />}>
            <div className="text-sm text-[#CCCCCC] leading-7 space-y-3">
              <p>这一版把数据积木从“主区平铺卡片墙”改成“左侧积木列表 + 中间详情视图”。</p>
              <p>左侧回归扫描型列表，中间主区则保留高表现力，这样报表类积木才真正有空间展开，而不是被压缩成几块小砖。</p>
            </div>
          </Panel>

          <Panel title="下一步可扩展" icon={<Workflow className="w-4 h-4 text-[#9CDCFE]" />}>
            <div className="space-y-2 text-sm text-[#CCCCCC] leading-6">
              <div>• 接入真实数据源与账号维度切换</div>
              <div>• 增加积木级配置面板</div>
              <div>• 在主区继续增强炫酷报表与大屏式指标展示</div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 shadow-inner">
      <div className="text-[11px] text-[#B8B8B8]">{label}</div>
      <div className="text-sm text-white mt-1 leading-6">{value}</div>
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon: JSX.Element; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#2A2A2A] bg-[#252526] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-[#CCCCCC]">
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
        <div key={item.label} className="rounded-xl border border-[#2A2A2A] bg-[#171718] p-3">
          <div className="text-[11px] text-[#858585]">{item.label}</div>
          <div className="text-sm text-[#CCCCCC] mt-1 leading-6">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function TimeDistributionPreview() {
  const bars = [44, 26, 61, 32, 78, 18, 25]
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="h-full flex flex-col justify-between gap-5">
      <div>
        <div className="text-sm text-[#CCCCCC]">过去 7 天推文发布分布</div>
        <div className="text-xs text-[#858585] mt-1">主区可以承载更完整的图表表达，而不是缩成小卡片。</div>
      </div>
      <div className="flex items-end gap-3 h-60">
        {bars.map((value, index) => (
          <div key={labels[index]} className="flex-1 flex flex-col justify-end items-center gap-2">
            <div className="w-full rounded-t-xl shadow-[0_10px_20px_rgba(0,0,0,0.18)] bg-gradient-to-t from-[#6D5BF6] via-[#8E7BFF] to-[#9CDCFE]" style={{ height: `${value * 2.2}px` }} />
            <div className="text-[11px] text-[#858585]">{labels[index]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InteractionPreview() {
  const metrics = [
    { label: '浏览量', value: '45,678' },
    { label: '点赞', value: '3,421' },
    { label: '转推', value: '892' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full">
      {metrics.map((metric, index) => (
        <div key={metric.label} className="rounded-xl border border-[#2A2A2A] bg-[linear-gradient(180deg,#1B1B1D_0%,#101011_100%)] p-4 flex flex-col justify-between shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
          <div className="text-xs text-[#858585]">{metric.label}</div>
          <div className="text-3xl font-semibold text-[#CCCCCC]">{metric.value}</div>
          <div className="h-2 rounded-full bg-[#1E1E1E] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${68 + index * 10}%`, background: index === 0 ? '#6D5BF6' : index === 1 ? '#4EC9B0' : '#9CDCFE' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AccountStatsPreview() {
  const stats = [
    { label: '关注', value: '234' },
    { label: '粉丝', value: '1,567' },
    { label: '推文', value: '892' },
    { label: '喜欢', value: '3,421' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-[#2A2A2A] bg-gradient-to-br from-[#161618] to-[#111112] p-5 flex flex-col justify-between min-h-[140px]">
          <div className="text-xs text-[#858585]">{stat.label}</div>
          <div className="text-3xl font-semibold text-[#FFFFFF]">{stat.value}</div>
        </div>
      ))}
    </div>
  )
}

function LatestTweetsPreview() {
  const tweets = [
    '这是一条测试推文，展示数据积木详情页在主显示区的展示能力。',
    '把左侧做轻，把主区做重，整个界面的可读性会直接上一个台阶。',
    '报表类积木回到主显示区后，终于有空间做更炫酷的表达了。',
  ]

  return (
    <div className="space-y-3">
      {tweets.map((tweet, index) => (
        <div key={tweet} className="rounded-xl border border-[#2A2A2A] bg-[linear-gradient(180deg,#171718_0%,#111112_100%)] p-4 shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
          <div className="text-[11px] text-[#858585] mb-2">{index === 0 ? '2小时前' : index === 1 ? '5小时前' : '1天前'}</div>
          <div className="text-sm text-[#CCCCCC] leading-7">{tweet}</div>
        </div>
      ))}
    </div>
  )
}

function TaskStatsPreview() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-64 h-64 rounded-full border-[18px] border-[#252526] relative flex items-center justify-center shadow-[0_16px_36px_rgba(0,0,0,0.22)] bg-[radial-gradient(circle_at_center,#1B1B1D_0%,#111112_72%)]">
        <div className="absolute inset-0 rounded-full border-[18px] border-transparent border-t-[#6D5BF6] border-r-[#4EC9B0] rotate-45" />
        <div className="text-center">
          <div className="text-4xl font-semibold text-[#FFFFFF]">85%</div>
          <div className="text-xs text-[#858585] mt-2">任务成功率</div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-md text-center rounded border border-[#2A2A2A] bg-[#252526] px-6 py-8">
        <div className="text-base font-semibold text-[#CCCCCC]">{title}</div>
        <p className="text-sm text-[#858585] mt-3 leading-6">{description}</p>
      </div>
    </div>
  )
}
