import { useState } from 'react'
import { ToolCallCard } from './ToolCallCard'
import type { ToolCall } from './types'

interface ProcessStepsProps {
  toolCalls: ToolCall[]
  isActive: boolean
}

export function ProcessSteps({ toolCalls, isActive }: ProcessStepsProps) {
  const [expanded, setExpanded] = useState(isActive)

  if (toolCalls.length === 0) return null

  const completedCount = toolCalls.filter(tc => tc.status === 'success').length
  const hasRunning = toolCalls.some(tc => tc.status === 'running')

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{
        borderColor: hasRunning ? '#4EC9B0' : 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 text-left flex items-center justify-between transition-colors"
        style={{ backgroundColor: expanded ? 'var(--color-hover-bg)' : 'transparent' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs">⚙️</span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Process</span>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            ({completedCount}/{toolCalls.length} steps{hasRunning ? ', running...' : ' completed'})
          </span>
        </div>
        <span className="text-xs transform transition-transform" style={{ color: 'var(--color-text-secondary)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▶
        </span>
      </button>
      {expanded && (
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          {toolCalls.map((tc) => (
            <ToolCallCard key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  )
}
