import { Folder, Settings, UserRound, Database, Zap } from 'lucide-react'

type ActivityView = 'workspace' | 'accounts' | 'data-blocks' | 'tasks'

interface ActivityBarProps {
  activeView: ActivityView
  onViewChange: (view: ActivityView) => void
  onOpenSettings: () => void
}

export function ActivityBar({ activeView, onViewChange, onOpenSettings }: ActivityBarProps) {
  const items: Array<{ id: ActivityView; icon: typeof Folder; label: string }> = [
    { id: 'workspace', icon: Folder, label: 'Workspace' },
    { id: 'accounts', icon: UserRound, label: 'Accounts' },
    { id: 'data-blocks', icon: Database, label: 'Data Blocks' },
    { id: 'tasks', icon: Zap, label: 'Tasks' },
  ]

  return (
    <div className="w-12 bg-[var(--vscode-bg-activity-bar)] flex flex-col items-center py-2 gap-1">
      <div className="flex flex-col items-center gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={[
                'relative w-12 h-12 flex items-center justify-center hover:bg-[var(--color-border)] transition-colors',
                isActive ? 'text-white' : 'text-[var(--color-text-secondary)]',
              ].join(' ')}
              aria-label={item.label}
              title={item.label}
            >
              {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white" />}
              <Icon className="w-6 h-6" />
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      <div className="w-8 h-px bg-[var(--color-border)] mb-1" />

      <button
        onClick={onOpenSettings}
        className="relative w-12 h-12 flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] transition-colors"
        aria-label="Settings"
        title="Settings"
      >
        <Settings className="w-6 h-6" />
      </button>
    </div>
  )
}
