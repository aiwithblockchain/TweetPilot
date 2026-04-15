import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import AccountCard from './AccountCard'
import AccountMappingDialog from './AccountMappingDialog'

export interface TwitterAccount {
  screenName: string
  displayName: string
  avatar: string
  status: 'online' | 'offline' | 'verifying'
  lastVerified: string
}

export default function AccountManagement() {
  const [accounts, setAccounts] = useState<TwitterAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showMappingDialog, setShowMappingDialog] = useState(false)

  useEffect(() => {
    loadAccounts()
    // Auto-verify all accounts on startup
    setTimeout(() => {
      verifyAllAccounts()
    }, 2000)
  }, [])

  const loadAccounts = async () => {
    try {
      const result = await invoke<TwitterAccount[]>('get_mapped_accounts')
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

      const status = await invoke<'online' | 'offline'>('verify_account_status', {
        screenName,
      })

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

  const handleDeleteAccount = async (screenName: string) => {
    if (!confirm(`确定要删除账号 ${screenName} 的映射吗？`)) {
      return
    }

    try {
      await invoke('delete_account_mapping', { screenName })
      setAccounts((prev) => prev.filter((acc) => acc.screenName !== screenName))
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('删除失败: ' + (error as Error).message)
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

      <button
        onClick={() => setShowMappingDialog(true)}
        className="mb-4 h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
      >
        映射账号
      </button>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-4xl mb-3">👤</div>
          <div className="text-base font-medium mb-1">暂无账号</div>
          <div className="text-xs text-secondary">点击"映射账号"按钮添加第一个账号</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.screenName}
              account={account}
              onRefresh={() => refreshAccountStatus(account.screenName)}
              onDelete={() => handleDeleteAccount(account.screenName)}
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
    </div>
  )
}
