import type { SidebarItem } from '@/config/layout'
import type { AppInstance } from '@/types/layout'
import { accountService } from '@/services'
import type { MappedAccount } from '@/services/account'
import { useEffect, useMemo, useState } from 'react'

interface AccountDetailPaneProps {
  item: SidebarItem | null
  instances: AppInstance[]
}

export function AccountDetailPane({ item, instances }: AccountDetailPaneProps) {
  const [accounts, setAccounts] = useState<MappedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await accountService.getMappedAccounts()
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

    return (
      accounts.find((account) => `account-${account.screenName.replace('@', '')}` === item.id) ??
      accounts.find((account) => account.screenName === item.label)
    )
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
        <div className="w-16 h-16 rounded-full overflow-hidden border border-[#2A2A2A] bg-[#1E1E1E] flex items-center justify-center">
          {selectedAccount?.avatar ? (
            <img src={selectedAccount.avatar} alt={selectedAccount.displayName ?? item.label} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl text-[#858585]">?</span>
          )}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[#CCCCCC] truncate">{selectedAccount?.displayName ?? item.label}</h2>
          <p className="text-sm text-[#858585] mt-1 truncate">{selectedAccount?.screenName ?? item.description}</p>
        </div>
      </div>

      <InfoPanel title="账号信息">
        <InfoGrid
          items={[
            { label: '账号名称', value: selectedAccount?.displayName ?? item.label },
            { label: '头像', value: selectedAccount?.avatar ? '已接入' : '暂未提供' },
            { label: '用户名', value: selectedAccount?.screenName ?? 'TODO' },
            { label: '状态', value: selectedAccount?.status ?? 'TODO' },
          ]}
        />
      </InfoPanel>

      <InfoPanel title="关联实例信息">
        <InfoGrid
          items={[
            { label: '实例名称', value: linkedInstance?.name ?? selectedAccount?.extensionName ?? 'TODO' },
            { label: '实例 ID', value: linkedInstance?.id ?? selectedAccount?.instanceId ?? 'TODO' },
            { label: '连接状态', value: linkedInstance ? formatInstanceStatus(linkedInstance.status) : 'TODO' },
            { label: '最后活跃', value: linkedInstance?.lastActive ?? 'TODO' },
          ]}
        />
      </InfoPanel>
    </div>
  )
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[#2A2A2A] bg-[#252526] p-4">
      <div className="text-sm font-semibold text-[#CCCCCC] mb-3">{title}</div>
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
          <div className="text-sm text-[#CCCCCC] mt-1 break-all">{item.value}</div>
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
            ? 'border-[#5A1D1D] bg-[#3A1F1F] text-[#F48771]'
            : 'border-[#2A2A2A] bg-[#252526] text-[#858585]',
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

function formatInstanceStatus(status: AppInstance['status']) {
  if (status === 'online') return '在线'
  if (status === 'connecting') return '连接中'
  return '离线'
}
