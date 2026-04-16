import { useState, useEffect } from 'react'
import { accountService } from '@/services'
import type { AvailableAccount } from '@/services/account'

interface AccountMappingDialogProps {
  onClose: () => void
  onAccountMapped: () => void
}

export default function AccountMappingDialog({
  onClose,
  onAccountMapped,
}: AccountMappingDialogProps) {
  const [accounts, setAccounts] = useState<AvailableAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mappingAccount, setMappingAccount] = useState<string | null>(null)

  useEffect(() => {
    loadAvailableAccounts()
  }, [])

  const loadAvailableAccounts = async () => {
    try {
      const result = await accountService.getAvailableAccounts()
      setAccounts(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败')
    } finally {
      setLoading(false)
    }
  }

  const handleMapAccount = async (account: AvailableAccount) => {
    setMappingAccount(account.screenName)
    try {
      await accountService.mapAccount(account.screenName)
      onAccountMapped()
    } catch (err) {
      alert('映射失败: ' + (err instanceof Error ? err.message : '未知错误'))
      setMappingAccount(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold">映射 Twitter 账号</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-secondary">正在查询可映射账号...</div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && accounts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <div className="text-4xl mb-2">🔍</div>
              <div className="text-sm font-medium mb-1">未找到可映射账号</div>
              <div className="text-xs text-secondary">
                请确保 LocalBridge 正在运行且已登录 Twitter 账号
              </div>
            </div>
          )}

          {!loading && !error && accounts.length > 0 && (
            <>
              <p className="text-sm text-secondary mb-3">
                请选择要映射的 Twitter 账号：
              </p>
              <div className="grid gap-3">
                {accounts.map((account) => (
                  <div
                    key={account.screenName}
                    className="flex items-center gap-3 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg"
                  >
                    <img
                      src={account.avatar}
                      alt={account.displayName}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{account.displayName}</div>
                      <div className="text-xs text-secondary">{account.screenName}</div>
                    </div>
                    <button
                      onClick={() => handleMapAccount(account)}
                      disabled={mappingAccount === account.screenName}
                      className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
                    >
                      {mappingAccount === account.screenName ? '映射中...' : '确认映射'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
