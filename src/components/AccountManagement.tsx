import { useMemo } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { addAccountToManagement, type AccountListItem } from '@/services/account'

interface AccountManagementProps {
  managedAccounts: AccountListItem[]
  unmanagedAccounts: AccountListItem[]
  onAccountsMutated?: () => Promise<void>
}

export default function AccountManagement({
  managedAccounts,
  unmanagedAccounts,
  onAccountsMutated,
}: AccountManagementProps) {
  const toast = useToast()

  const pendingPromptCount = useMemo(
    () => managedAccounts.filter((account) => !account.personalityPrompt).length,
    [managedAccounts],
  )

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">账号管理概览</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 leading-6">
          V1 主界面仅展示当前已管理账号与未管理在线账号。历史管理账号保留在数据库中，但不在此处展示。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="当前已管理账号" value={String(managedAccounts.length)} />
        <StatCard label="未管理在线账号" value={String(unmanagedAccounts.length)} />
        <StatCard label="待补性格提示词" value={String(pendingPromptCount)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AccountListSection title="当前已管理账号" accounts={managedAccounts} emptyMessage="当前没有已管理账号。" />
        <AccountListSection
          title="未管理在线账号"
          accounts={unmanagedAccounts}
          emptyMessage="当前没有未管理在线账号。"
          actionLabel="加入管理"
          onAction={async (twitterId) => {
            await addAccountToManagement(twitterId)
            toast.success('账号已加入管理')
            await (onAccountsMutated ? onAccountsMutated() : Promise.resolve())
          }}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-2xl font-semibold text-[var(--color-text)] mt-2">{value}</div>
    </div>
  )
}

function AccountListSection({
  title,
  accounts,
  emptyMessage,
  actionLabel,
  onAction,
}: {
  title: string
  accounts: AccountListItem[]
  emptyMessage: string
  actionLabel?: string
  onAction?: (twitterId: string) => Promise<void>
}) {
  return (
    <section className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      {accounts.length === 0 ? (
        <div className="text-sm text-[var(--color-text-secondary)]">{emptyMessage}</div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div key={account.twitterId} className="flex items-center justify-between gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
              <div className="min-w-0">
                <div className="text-sm text-[var(--color-text)] truncate">{account.displayName || account.screenName || account.twitterId}</div>
                <div className="text-xs text-[var(--color-text-secondary)] truncate">
                  {account.screenName ? `@${account.screenName}` : account.twitterId}
                  {account.instanceId ? ` · ${account.instanceId}` : ''}
                </div>
              </div>
              {actionLabel && onAction ? (
                <button
                  type="button"
                  onClick={() => {
                    void onAction(account.twitterId)
                  }}
                  className="px-3 py-1.5 rounded border border-[var(--color-border)] text-xs text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] transition-colors cursor-pointer"
                >
                  {actionLabel}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
