import { SessionList } from './SessionList'
import type { SessionMetadata } from '@/services/ai/tauri'

interface SessionPanelProps {
  sessions: SessionMetadata[]
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onClose: () => void
}

export function SessionPanel({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onClose,
}: SessionPanelProps) {
  return (
    <div
      className="absolute top-0 right-0 h-full w-80 border-l shadow-lg animate-slide-in-right z-50"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderLeftColor: 'var(--color-border)',
      }}
    >
      <SessionList
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={onSelectSession}
        onDeleteSession={onDeleteSession}
        onClose={onClose}
      />
    </div>
  )
}
