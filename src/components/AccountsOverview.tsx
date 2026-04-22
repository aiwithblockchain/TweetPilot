import { useEffect, useState } from 'react'
import { accountService } from '@/services'
import type { ManagedAccount } from '@/services/account'
import type { SidebarItem } from '@/config/layout'

interface AccountsOverviewProps {
  item: SidebarItem | null
}

export function AccountsOverview({ item }: AccountsOverviewProps) {
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

  const selected = item ?? {
    id: 'acc-main',
    label: '账号概览',
    description: '当前账号状态总览',
  }

  const filteredAccounts = accounts.filter((account) => {
    if (!selected?.id?.startsWith('acc-')) return true
    if (selected.id === 'acc-main') return account.screenName.includes('main') || accounts.indexOf(account) === 0
    if (selected.id === 'acc-growth') return account.screenName.includes('growth') || accounts.indexOf(account) === 1
    if (selected.id === 'acc-backup') return account.screenName.includes('backup') || accounts.indexOf(account) === 2
    return true
  })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{selected.label}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-6">{selected.description}</p>
      </div>

      {loading ? (
        <PanelMessage message="正在加载账号信息..." />
      ) : error ? (
        <PanelMessage message={error} tone="error" />
      ) : filteredAccounts.length === 0 ? (
        <PanelMessage message="当前没有匹配的账号，后续可在此接入账号管理与详情页。" />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredAccounts.map((account) => (
            <AccountSummaryCard key={account.twitterId} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}

function AccountSummaryCard({ account }: { account: ManagedAccount }) {
  const statusColor = account.isOnline
    ? 'text-[#4EC9B0] bg-[#4EC9B0]/10 border-[#4EC9B0]/40'
    : 'text-[#F48771] bg-[#F48771]/10 border-[#F48771]/40'

  const statusText = account.isOnline ? '在线' : '离线'

  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-3">
        <img
          src={account.avatarUrl || 'https://pbs.twimg.com/profile_images/default_profile_400x400.png'}
          alt={account.displayName}
          className="w-12 h-12 rounded-full object-cover border border-[var(--color-border)]"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-text)] truncate">{account.displayName}</div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1 truncate">{account.screenName}</div>
        </div>
        <span className={['text-[11px] px-2 py-1 rounded border whitespace-nowrap', statusColor].join(' ')}>
          {statusText}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <InfoBlock label="最后在线" value={account.lastOnlineTime ? formatRelativeTime(account.lastOnlineTime) : '未知'} />
        <InfoBlock label="实例" value={account.extensionName || account.instanceId || '未绑定'} />
        <InfoBlock label="Twitter ID" value={account.twitterId || '未知'} />
        <InfoBlock label="认证状态" value={account.isVerified ? '已认证' : '未认证'} />
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-xs text-[var(--color-text)] mt-1 break-all leading-5">{value}</div>
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

function formatRelativeTime(isoString: string) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return isoString

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-CN')
}
