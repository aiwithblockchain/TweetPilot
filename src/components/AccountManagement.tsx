import { useState, useEffect } from 'react'
import { accountService } from '@/services'
import type { ManagedAccount, AvailableAccount } from '@/services/account'
import { useToast } from '@/contexts/ToastContext'

export default function AccountManagement() {
  const toast = useToast()
  const [managedAccounts, setManagedAccounts] = useState<ManagedAccount[]>([])
  const [availableAccounts, setAvailableAccounts] = useState<AvailableAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [managedExpanded, setManagedExpanded] = useState(() => {
    const saved = localStorage.getItem('accountManagement.managedExpanded')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [availableExpanded, setAvailableExpanded] = useState(() => {
    const saved = localStorage.getItem('accountManagement.availableExpanded')
    return saved !== null ? JSON.parse(saved) : true
  })
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    twitterId: string
  } | null>(null)

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    localStorage.setItem('accountManagement.managedExpanded', JSON.stringify(managedExpanded))
  }, [managedExpanded])

  useEffect(() => {
    localStorage.setItem('accountManagement.availableExpanded', JSON.stringify(availableExpanded))
  }, [availableExpanded])

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const [managed, available] = await Promise.all([
        accountService.getManagedAccounts(),
        accountService.getAvailableAccounts(),
      ])
      setManagedAccounts(managed)
      setAvailableAccounts(available)
    } catch (error) {
      console.error('Failed to load accounts:', error)
      toast.error('加载账号失败: ' + error)
    } finally {
      setLoading(false)
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

  const handleAddToManagement = async (twitterId: string) => {
    try {
      await accountService.addAccountToManagement(twitterId)
      await loadAccounts()
      toast.success('账号已添加到管理')
    } catch (error) {
      toast.error('添加失败: ' + error)
    }
  }

  const handleRemoveFromManagement = async (twitterId: string) => {
    try {
      await accountService.removeAccountFromManagement(twitterId)
      await loadAccounts()
      toast.success('账号已移出管理')
    } catch (error) {
      toast.error('移除失败: ' + error)
    }
  }

  const handleDeleteCompletely = async (twitterId: string) => {
    if (!confirm('确定要完全删除此账号吗？此操作不可恢复。')) {
      return
    }
    try {
      await accountService.deleteAccountCompletely(twitterId)
      await loadAccounts()
      toast.success('账号已删除')
    } catch (error) {
      toast.error('删除失败: ' + error)
    }
  }

  if (loading && managedAccounts.length === 0 && availableAccounts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-secondary">加载中...</div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-base font-semibold mb-4">Twitter 账号管理</h3>

      <div className="mb-4">
        <button
          onClick={handleRefreshAllAccounts}
          disabled={loading}
          className="h-8 px-3 text-sm bg-[#10A37F] text-white rounded hover:bg-[#0E8C6F] transition-colors disabled:opacity-50"
        >
          {loading ? '刷新中...' : '刷新账号状态'}
        </button>
      </div>

      {/* Managed Accounts Section */}
      <div className="mb-6">
        <button
          onClick={() => setManagedExpanded(!managedExpanded)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">管理中的账号</span>
            <span className="text-xs text-secondary">({managedAccounts.length})</span>
          </div>
          <svg
            className={`w-5 h-5 transition-transform ${managedExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {managedExpanded && (
          <div className="mt-3 space-y-2">
            {managedAccounts.length === 0 ? (
              <div className="text-sm text-secondary text-center py-8">暂无管理中的账号</div>
            ) : (
              managedAccounts.map((account) => (
                <div
                  key={account.twitterId}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      twitterId: account.twitterId,
                    })
                  }}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={account.avatarUrl || 'https://pbs.twimg.com/profile_images/default_profile_400x400.png'}
                      alt={account.displayName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="text-sm font-medium">{account.displayName}</div>
                      <div className="text-xs text-secondary">{account.screenName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        account.isOnline
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {account.isOnline ? '在线' : '离线'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => {
              handleRemoveFromManagement(contextMenu.twitterId)
              setContextMenu(null)
            }}
          >
            移出管理
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => {
              handleDeleteCompletely(contextMenu.twitterId)
              setContextMenu(null)
            }}
          >
            完全删除
          </button>
        </div>
      )}

      {/* Available Accounts Section */}
      <div>
        <button
          onClick={() => setAvailableExpanded(!availableExpanded)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">可用账号</span>
            <span className="text-xs text-secondary">({availableAccounts.length})</span>
          </div>
          <svg
            className={`w-5 h-5 transition-transform ${availableExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {availableExpanded && (
          <div className="mt-3 space-y-2">
            {availableAccounts.length === 0 ? (
              <div className="text-sm text-secondary text-center py-8">暂无可用账号</div>
            ) : (
              availableAccounts.map((account) => (
                <div
                  key={account.twitterId}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={account.avatarUrl || 'https://pbs.twimg.com/profile_images/default_profile_400x400.png'}
                      alt={account.displayName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="text-sm font-medium">{account.displayName}</div>
                      <div className="text-xs text-secondary">{account.screenName}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddToManagement(account.twitterId)}
                    className="text-sm px-3 py-1 bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
                  >
                    添加
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
