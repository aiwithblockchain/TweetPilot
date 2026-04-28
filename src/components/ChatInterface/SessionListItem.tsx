import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { SessionMetadata } from '@/services/ai/tauri'

interface SessionListItemProps {
  session: SessionMetadata
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

function formatSessionTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const oneDay = 24 * 60 * 60 * 1000

  if (diff < oneDay) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } else if (diff < 2 * oneDay) {
    return '昨天'
  } else if (diff < 7 * oneDay) {
    return `${Math.floor(diff / oneDay)} 天前`
  } else {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    })
  }
}

export function SessionListItem({ session, isActive, onSelect, onDelete }: SessionListItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={`group relative px-3 py-2.5 cursor-pointer transition-all border-b ${
        isActive ? 'border-l-3 border-l-[#007ACC] pl-[9px]' : ''
      }`}
      style={{
        borderBottomColor: 'var(--color-border)',
        backgroundColor: isActive
          ? 'rgba(0, 122, 204, 0.1)'
          : isHovered
            ? 'var(--color-bg)'
            : 'transparent',
        opacity: isActive || !isHovered ? 1 : 0.8,
      }}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-xs font-medium mb-1 truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {session.title}
          </div>
          <div
            className="text-[11px] flex items-center gap-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span>{formatSessionTime(session.updated_at)}</span>
            <span>·</span>
            <span>{session.message_count} messages</span>
          </div>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-[#F48771]"
          style={{ color: 'var(--color-text-secondary)' }}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
