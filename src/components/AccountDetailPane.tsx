import type { SidebarItem } from '@/config/layout'
import type { AppInstance } from '@/types/layout'
import { accountService } from '@/services'
import type { ManagedAccount } from '@/services/account'
import { useEffect, useMemo, useState } from 'react'

interface AccountDetailPaneProps {
  item: SidebarItem | null
  instances: AppInstance[]
}

export function AccountDetailPane({ item, instances }: AccountDetailPaneProps) {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await accountService.getManagedAccounts()
        setAccounts(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : '读取账号失败')
      } finally {
        setLoading(false)
      }
    }

    void loadAccounts()
  }, [])

  const selectedAccount = useMemo(() => {
    if (!item) return null

    // item.id is the twitterId from the sidebar
    return accounts.find((account) => account.twitterId === item.id)
  }, [accounts, item])

  const linkedInstance = useMemo(() => {
    if (!selectedAccount) return null
    return instances.find((instance) => instance.id === selectedAccount.instanceId) ?? instances[0] ?? null
  }, [instances, selectedAccount])

  if (!item) {
    return <EmptyState title="推特账号" description="请先在左侧选择一个推特账号，再在中间查看账号与关联实例详情。" />
  }

  if (loading) {
    return <MessageState message="正在加载推特账号详情..." />
  }

  if (error) {
    return <MessageState message={error} tone="error" />
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] flex items-center justify-center">
          {selectedAccount?.avatarUrl ? (
            <img src={selectedAccount.avatarUrl} alt={selectedAccount.displayName ?? item.label} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl text-[var(--color-text-secondary)]">?</span>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text)] truncate">{selectedAccount?.displayName ?? item.label}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1 truncate">{selectedAccount?.screenName ?? item.description}</p>
        </div>
      </div>

      <InfoPanel title="账号信息">
        <InfoGrid
          items={[
            { label: '账号名称', value: selectedAccount?.displayName ?? item.label },
            { label: '用户名', value: selectedAccount?.screenName ?? 'TODO' },
            { label: 'Twitter ID', value: selectedAccount?.twitterId ?? '未知' },
            { label: '状态', value: selectedAccount?.isOnline ? '在线' : '离线' },
          ]}
        />
      </InfoPanel>

      <InfoPanel title="账号统计">
        <InfoGrid
          items={[
            { label: '粉丝数', value: '暂无数据' },
            { label: '关注数', value: '暂无数据' },
            { label: '推文数', value: '暂无数据' },
            { label: '简介', value: selectedAccount?.description || '暂无简介' },
          ]}
        />
      </InfoPanel>

      <InfoPanel title="关联实例信息">
        <InfoGrid
          items={[
            { label: '实例名称', value: linkedInstance?.name ?? selectedAccount?.extensionName ?? '未知' },
            { label: '实例 ID', value: linkedInstance?.id ?? selectedAccount?.instanceId ?? '未知' },
          ]}
        />
      </InfoPanel>
    </div>
  )
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-sm font-semibold text-[var(--color-text)] mb-3">{title}</div>
      {children}
    </section>
  )
}

function InfoGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
          <div className="text-[11px] text-[var(--color-text-secondary)]">{item.label}</div>
          <div className="text-sm text-[var(--color-text)] mt-1 break-all">{item.value}</div>
        </div>
      ))}
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
