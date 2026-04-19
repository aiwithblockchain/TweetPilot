import { Plus } from 'lucide-react'
import type { SidebarItem } from '@/config/layout'

interface DataBlockDetailPaneProps {
  item: SidebarItem | null
}

export function DataBlockDetailPane({ item }: DataBlockDetailPaneProps) {
  if (!item) {
    return <EmptyState title="数据积木" description="请先在左侧选择一个数据积木，或点击左上角 + 号新增积木。" />
  }

  return (
    <div className="p-6 space-y-5">
      <Header title={item.label} subtitle={item.description} />

      <Panel title="积木摘要">
        <InfoGrid
          items={[
            { label: '名称', value: item.label },
            { label: '类型', value: 'Mock 类型' },
            { label: '状态', value: '待完善' },
            { label: '来源', value: '当前先用于 UI 重构验证' },
          ]}
        />
      </Panel>

      <Panel title="输入 / 输出">
        <div className="rounded border border-dashed border-[#2A2A2A] bg-[#1E1E1E] px-4 py-6 text-sm text-[#858585] leading-6">
          这里会展示数据积木的输入输出结构、配置项和示例数据。当前阶段先保证左侧列表和中间详情的 UI 结构正确。
        </div>
      </Panel>
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[#CCCCCC]">{title}</h2>
      <p className="text-sm text-[#858585] mt-1 leading-6">{subtitle}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[#2A2A2A] bg-[#252526] p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-[#CCCCCC]">
        <Plus className="w-4 h-4 text-[#858585]" />
        {title}
      </div>
      {children}
    </section>
  )
}

function InfoGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded border border-[#2A2A2A] bg-[#1E1E1E] p-3">
          <div className="text-[11px] text-[#858585]">{item.label}</div>
          <div className="text-sm text-[#CCCCCC] mt-1">{item.value}</div>
        </div>
      ))}
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
