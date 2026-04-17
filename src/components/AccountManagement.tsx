import { useState, useEffect } from 'react'
import AccountCard from './AccountCard'
import AccountMappingDialog from './AccountMappingDialog'
import AccountSettingsDialog from './AccountSettingsDialog'
import { accountService } from '@/services'
import type { MappedAccount } from '@/services/account'
import { useToast } from '@/contexts/ToastContext'

export type TwitterAccount = MappedAccount

export default function AccountManagement() {
  const toast = useToast()
  const [accounts, setAccounts] = useState<MappedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showMappingDialog, setShowMappingDialog] = useState(false)
  const [settingsScreenName, setSettingsScreenName] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()
    // Auto-verify all accounts on startup
    setTimeout(() => {
      verifyAllAccounts()
    }, 2000)
  }, [])

  const loadAccounts = async () => {
    try {
      const result = await accountService.getMappedAccounts()
      setAccounts(result)
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const verifyAllAccounts = async () => {
    for (const account of accounts) {
      await refreshAccountStatus(account.screenName)
    }
  }

  const refreshAccountStatus = async (screenName: string) => {
    try {
      // Update status to verifying
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.screenName === screenName ? { ...acc, status: 'verifying' } : acc
        )
      )

      const status = await accountService.verifyAccountStatus(screenName)

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.screenName === screenName
            ? { ...acc, status, lastVerified: new Date().toISOString() }
            : acc
        )
      )
    } catch (error) {
      console.error('Failed to verify account:', error)
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.screenName === screenName ? { ...acc, status: 'offline' } : acc
        )
      )
    }
  }

  const handleRefreshAllAccounts = async () => {
    try {
      setLoading(true)
      await accountService.refreshAllAccountsStatus()
      await loadAccounts()
      toast.success('账号状态已刷新')
    } catch (error) {
      toast.error('刷新失败: ' + error)
    } finally {
      setLoading(false)
    }
  }


  const handleAccountMapped = () => {
    setShowMappingDialog(false)
    loadAccounts()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-secondary">加载中...</div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-base font-semibold mb-4">Twitter 账号管理</h3>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setShowMappingDialog(true)}
          className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
        >
          映射账号
        </button>
        <button
          onClick={handleRefreshAllAccounts}
          className="h-8 px-3 text-sm bg-[#10A37F] text-white rounded hover:bg-[#0E8C6F] transition-colors"
        >
          刷新账号状态
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-4xl mb-3">👤</div>
          <div className="text-base font-medium mb-1">暂无账号</div>
          <div className="text-xs text-secondary">点击"映射账号"按钮添加第一个账号</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.screenName}
              account={account}
              onSettings={() => setSettingsScreenName(account.screenName)}
            />
          ))}
        </div>
      )}

      {showMappingDialog && (
        <AccountMappingDialog
          onClose={() => setShowMappingDialog(false)}
          onAccountMapped={handleAccountMapped}
        />
      )}

      {settingsScreenName && (
        <AccountSettingsDialog
          screenName={settingsScreenName}
          onClose={() => setSettingsScreenName(null)}
          onAccountDeleted={() => {
            setSettingsScreenName(null)
            loadAccounts()
          }}
        />
      )}
    </div>
  )
}
