import type { SidebarItem } from '@/config/layout'
import type { AppInstance } from '@/types/layout'

interface AccountDetailPaneProps {
  item: SidebarItem | null
  instances: AppInstance[]
}

export function AccountDetailPane({ item }: AccountDetailPaneProps) {
  if (!item) {
    return <EmptyState title="推特账号" description="请先在左侧选择一个推特账号，再在中间查看账号与关联实例详情。" />
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center">
          <span className="text-xl text-[var(--color-text-secondary)]">?</span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text)] truncate">{item.label}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 truncate">{item.description}</p>
        </div>
      </div>

      <MessageState message="账号详情功能正在重构中，即将推出新的账号管理界面。" />
    </div>
  )
}

function MessageState({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div
        className={[
          'max-w-md text-center rounded border px-6 py-8 text-sm',
          tone === 'error'
            ? 'border-red-800/50 bg-red-950/30 text-[#F48771]'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
        ].join(' ')}
      >
        {message}
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <MessageState message={`${title}：${description}`} />
}
