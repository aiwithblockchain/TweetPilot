import { Suspense, lazy } from 'react'

const ChatInterface = lazy(async () => {
  const module = await import('./ChatInterface')
  return { default: module.ChatInterface }
})

interface RightPanelProps {
  width: number
  onToggle: () => void
  onOpenSettings?: (section?: 'account' | 'preferences' | 'ai-providers') => void
}

export function RightPanel({ width, onToggle, onOpenSettings }: RightPanelProps) {
  return (
    <aside
      className="bg-[var(--color-surface)] border-l border-[var(--color-border)] flex flex-col flex-shrink-0 min-w-0"
      style={{ width }}
    >
      <div className="h-9 border-b border-[var(--color-border)] px-3 flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--color-text)] tracking-[0.04em]">TweetPilot</div>
        <button
          onClick={onToggle}
          className="cursor-pointer text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-strong)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-surface)]"
          aria-label="折叠 AI 面板"
        >
          隐藏
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-[var(--color-text-secondary)]">加载 AI 面板中...</div>}>
          <ChatInterface onOpenSettings={() => onOpenSettings?.('ai-providers')} />
        </Suspense>
      </div>
    </aside>
  )
}
