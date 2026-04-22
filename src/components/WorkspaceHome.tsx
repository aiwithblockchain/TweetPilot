import { useMemo } from 'react'
import type { SidebarItem } from '@/config/layout'
import type { AppInstance } from '@/types/layout'

interface WorkspaceHomeProps {
  item: SidebarItem | null
  instances: AppInstance[]
  instancesError?: string | null
}

const WORKSPACE_SECTIONS: Record<string, { title: string; description: string; highlights: string[] }> = {
  'ws-default': {
    title: 'TweetPilot 工作区',
    description: '当前主工作区聚焦 VSCode 风格 UI 重构的总体状态与关键运行信息。',
    highlights: ['四栏布局已稳定运行', '支持左右面板拖拽与持久化', '紧凑模式下支持移动侧边栏抽屉'],
  },
  'ws-assets': {
    title: '资源面板',
    description: '查看当前布局资产、样式变量与组件拆分情况。',
    highlights: ['布局配置已抽离到 src/config/layout.ts', 'DetailPanel / Sidebar / RightPanel 已模块化', '主题色和基础样式已统一'],
  },
  'ws-notes': {
    title: '重构说明',
    description: '记录 P0-14 重构方案的当前实现进展与后续建议。',
    highlights: ['阶段 1-5 已完成', '阶段 6 已完成基础响应式', '下一步建议补 workspace/accounts 真实联动'],
  },
}

export function WorkspaceHome({ item, instances, instancesError }: WorkspaceHomeProps) {
  const selected = item ?? {
    id: 'ws-default',
    label: 'TweetPilot 工作区',
    description: '当前项目总览',
  }

  const section = WORKSPACE_SECTIONS[selected.id] ?? WORKSPACE_SECTIONS['ws-default']
  const onlineCount = useMemo(() => instances.filter((instance) => instance.status === 'online').length, [instances])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{section.title}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-6">{section.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="实例总数" value={String(instances.length)} hint="来自 LocalBridge" />
        <MetricCard label="在线实例" value={String(onlineCount)} hint="用于快速判断当前运行状态" />
        <MetricCard label="当前视图" value={selected.label} hint={selected.description} />
      </div>

      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="text-sm font-semibold text-[var(--color-text)] mb-3">当前重点</div>
        <ul className="space-y-2 text-xs text-[var(--color-text-secondary)] leading-5">
          {section.highlights.map((highlight) => (
            <li key={highlight}>• {highlight}</li>
          ))}
        </ul>
      </div>

      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <div className="text-sm font-semibold text-[var(--color-text)]">实例快照</div>
          {instancesError && <span className="text-[11px] text-[#F48771]">{instancesError}</span>}
        </div>

        <div className="space-y-2">
          {instances.map((instance) => (
            <div key={instance.id} className="flex items-center justify-between gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm text-[var(--color-text)] truncate">{instance.name}</div>
                <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">最后活跃：{instance.lastActive}</div>
              </div>
              <span
                className={[
                  'text-[11px] px-2 py-1 rounded border whitespace-nowrap',
                  instance.status === 'online'
                    ? 'text-[#4EC9B0] border-[#4EC9B0]/40 bg-[#4EC9B0]/10'
                    : instance.status === 'connecting'
                      ? 'text-[#D7BA7D] border-[#D7BA7D]/40 bg-[#D7BA7D]/10'
                      : 'text-[#F48771] border-[#F48771]/40 bg-[#F48771]/10',
                ].join(' ')}
              >
                {instance.status === 'online' ? '在线' : instance.status === 'connecting' ? '连接中' : '离线'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-lg font-semibold text-[var(--color-text)] mt-2">{value}</div>
      <div className="text-xs text-[var(--color-text-secondary)] mt-2 leading-5">{hint}</div>
    </div>
  )
}
