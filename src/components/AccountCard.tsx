import { TwitterAccount } from './AccountManagement'

interface AccountCardProps {
  account: TwitterAccount
  onSettings: () => void
}

export default function AccountCard({ account, onSettings }: AccountCardProps) {
  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins} 分钟前`
    if (diffHours < 24) return `${diffHours} 小时前`
    if (diffDays < 7) return `${diffDays} 天前`
    return date.toLocaleDateString('zh-CN')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'offline':
        return 'bg-red-500'
      case 'verifying':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return '在线'
      case 'offline':
        return '离线'
      case 'verifying':
        return '验证中'
      default:
        return '未知'
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[#6D5BF6] hover:shadow-sm transition-all">
      <img
        src={account.avatar}
        alt={account.displayName}
        className="w-16 h-16 rounded-full object-cover"
      />

      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm mb-0.5">{account.displayName}</div>
        <div className="text-xs text-secondary mb-2">{account.screenName}</div>
        <div className="flex items-center gap-3 text-xs text-secondary">
          <span className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${getStatusColor(account.status)}`}></span>
            {getStatusText(account.status)}
          </span>
          <span>{formatRelativeTime(account.lastVerified)}</span>
        </div>
      </div>

      <div className="flex gap-1">
        <button
          onClick={onSettings}
          className="w-8 h-8 flex items-center justify-center text-sm hover:bg-[var(--color-bg)] rounded transition-colors"
          title="设置"
        >
          ⚙️
        </button>
      </div>
    </div>
  )
}
