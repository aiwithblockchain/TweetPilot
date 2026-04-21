import { useState } from 'react'

interface ThinkingBlockProps {
  thinking: string
  isActive: boolean
  isComplete: boolean
}

export function ThinkingBlock({ thinking, isActive, isComplete }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(isActive)

  if (!thinking) return null

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{
        borderColor: isActive ? '#569CD6' : 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        animation: isActive ? 'pulse-border 2s ease-in-out infinite' : 'none',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 text-left flex items-center justify-between transition-colors"
        style={{ backgroundColor: expanded ? 'var(--color-hover-bg)' : 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs">🧠</span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Thinking</span>
          {isActive && (
            <div className="flex gap-0.5">
              <span className="inline-block w-1 h-1 bg-[#569CD6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="inline-block w-1 h-1 bg-[#569CD6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="inline-block w-1 h-1 bg-[#569CD6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          )}
        </div>
        <span className="text-xs transform transition-transform" style={{ color: 'var(--color-text-secondary)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
      </button>
      {expanded && (
        <div className="px-3 py-2 text-xs whitespace-pre-wrap max-h-64 overflow-y-auto" style={{ color: 'var(--color-text)', borderTop: '1px solid var(--color-border)' }}>
          {thinking}
        </div>
      )}
    </div>
  )
}
