import { ClipboardList } from 'lucide-react'
import type { SidebarItem } from '@/config/layout'

interface TaskDetailPaneProps {
  item: SidebarItem | null
  mode?: 'detail' | 'create'
}

export function TaskDetailPane({ item, mode = 'detail' }: TaskDetailPaneProps) {
  if (mode === 'create') {
    return <TaskCreatePane />
  }

  if (!item) {
    return <EmptyState title="任务" description="请先在左侧选择一个任务，或点击左上角 + 号新建任务。" />
  }

  return (
    <div className="p-6 space-y-5">
      <Header title={item.label} subtitle={item.description} />

      <Panel title="任务详情">
        <InfoGrid
          items={[
            { label: '任务名称', value: item.label },
            { label: '状态', value: '进行中 / TODO' },
            { label: '调度', value: item.description },
            { label: '执行记录', value: '后续接入真实任务日志' },
          ]}
        />
      </Panel>
    </div>
  )
}

export function TaskCreatePane() {
  return (
    <div className="p-6 space-y-5">
      <Header title="新建任务" subtitle="任务创建界面在中间主显示区打开，不再挤在左侧窄栏中。" />

      <Panel title="任务表单占位">
        <div className="grid grid-cols-1 gap-4">
          <Field label="任务名称" placeholder="例如：每日内容发布" />
          <Field label="任务说明" placeholder="描述这个任务要做什么" multiline />
          <Field label="调度规则" placeholder="例如：每天 18:00" />
          <button className="h-9 px-4 rounded bg-[#007ACC] text-white text-sm w-fit hover:bg-[#1485D1] transition-colors">
            创建任务
          </button>
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
        <ClipboardList className="w-4 h-4 text-[#858585]" />
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
          <div className="text-sm text-[#CCCCCC] mt-1 leading-6">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function Field({ label, placeholder, multiline = false }: { label: string; placeholder: string; multiline?: boolean }) {
  return (
    <label className="block">
      <div className="text-xs text-[#858585] mb-2">{label}</div>
      {multiline ? (
        <textarea
          rows={5}
          placeholder={placeholder}
          className="w-full rounded border border-[#2A2A2A] bg-[#1E1E1E] px-3 py-2 text-sm text-[#CCCCCC] placeholder:text-[#6B6B6B] outline-none focus:border-[#094771]"
        />
      ) : (
        <input
          placeholder={placeholder}
          className="w-full h-10 rounded border border-[#2A2A2A] bg-[#1E1E1E] px-3 text-sm text-[#CCCCCC] placeholder:text-[#6B6B6B] outline-none focus:border-[#094771]"
        />
      )}
    </label>
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
