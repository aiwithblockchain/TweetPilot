import { SessionListItem } from './SessionListItem'
import type { SessionMetadata } from '@/services/ai/tauri'

interface SessionListProps {
  sessions: SessionMetadata[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onClose: () => void
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onClose,
}: SessionListProps) {
  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderBottomColor: 'var(--color-border)' }}
      >
        <h3 className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>
          会话历史
        </h3>
        <button
          onClick={onClose}
          className="text-lg leading-none hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ×
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div
            className="flex items-center justify-center h-full px-4 text-center text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            暂无会话历史
          </div>
        ) : (
          sessions.map((session) => (
            <SessionListItem
              key={session.id}
              session={session}
              isActive={session.id === currentSessionId}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
