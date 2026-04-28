import { useEffect, useState } from 'react'
import type { SidebarItem } from '@/config/layout'

interface AccountsOverviewProps {
  item: SidebarItem | null
}

export function AccountsOverview({ item }: AccountsOverviewProps) {
  const [loading] = useState(false)

  useEffect(() => {
    // Account loading removed - will be reimplemented
  }, [])

  const selected = item ?? {
    id: 'acc-main',
    label: '账号概览',
    description: '当前账号状态总览',
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{selected.label}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-6">{selected.description}</p>
      </div>

      {loading ? (
        <PanelMessage message="正在加载账号信息..." />
      ) : (
        <PanelMessage message="账号功能正在重构中，即将推出新的账号管理界面。" />
      )}
    </div>
  )
}

function PanelMessage({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' }) {
  return (
    <div
      className={[
        'rounded border p-4 text-sm',
        tone === 'error'
          ? 'border-red-800/50 bg-red-950/30 text-[#F48771]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
      ].join(' ')}
    >
      {message}
    </div>
  )
}
