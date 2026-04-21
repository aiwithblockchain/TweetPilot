import type { AppInstance } from '@/types/layout'

interface InstanceStatusPanelProps {
  instances: AppInstance[]
  errorMessage?: string | null
}

const STATUS_STYLES: Record<AppInstance['status'], { dot: string; text: string; label: string }> = {
  online: {
    dot: 'bg-[#4EC9B0]',
    text: 'text-[#4EC9B0]',
    label: '在线',
  },
  offline: {
    dot: 'bg-[#F48771]',
    text: 'text-[#F48771]',
    label: '离线',
  },
  connecting: {
    dot: 'bg-[#D7BA7D]',
    text: 'text-[#D7BA7D]',
    label: '连接中',
  },
}

export function InstanceStatusPanel({ instances, errorMessage }: InstanceStatusPanelProps) {
  return (
    <div className="p-3 bg-[var(--color-surface)]">
      <div className="text-[11px] tracking-[0.08em] text-[var(--color-text)] font-semibold mb-3">
        🔌 TWEETCLAW INSTANCES
      </div>

      {errorMessage && (
        <div className="mb-3 rounded border border-red-800/50 bg-red-950/30 px-3 py-2 text-[11px] text-[#F48771]">
          {errorMessage}
        </div>
      )}

      <div className="space-y-3">
        {instances.map((instance) => {
          const status = STATUS_STYLES[instance.status]

          return (
            <div key={instance.id} className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <span className={['w-2 h-2 rounded-full', status.dot].join(' ')} />
                <span className="truncate flex-1">{instance.name}</span>
                <span className={['text-[11px]', status.text].join(' ')}>{status.label}</span>
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1.5">ID: {instance.id}...</div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">最后活跃: {instance.lastActive}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
