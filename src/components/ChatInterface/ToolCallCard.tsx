import { useState } from 'react'
import type { ToolCall } from './types'

const TOOL_LABELS: Record<string, string> = {
  Read: 'Read',
  Edit: 'Edit',
  Write: 'Write',
  Bash: 'Bash',
  Glob: 'Glob',
  Grep: 'Grep',
}

const TOOL_COLORS: Record<string, string> = {
  running: '#569CD6',
  success: '#4EC9B0',
  error: '#F48771',
}

interface ToolCallCardProps {
  toolCall: ToolCall
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [outputExpanded, setOutputExpanded] = useState(false)
  const label = TOOL_LABELS[toolCall.tool] || toolCall.tool || 'Tool'
  const statusColor = TOOL_COLORS[toolCall.status]
  const hasOutput = Boolean(toolCall.output && toolCall.output.length > 0)

  return (
    <div
      className="rounded-md border overflow-hidden transition-colors"
      style={{
        borderColor: toolCall.status === 'running' ? statusColor : 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border"
            style={{
              color: statusColor,
              borderColor: statusColor,
              backgroundColor: 'transparent',
            }}
          >
            {label}
          </span>
          {toolCall.status === 'running' && (
            <div className="flex gap-0.5" aria-hidden="true">
              <span className="inline-block w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: statusColor, animationDelay: '0ms' }}></span>
              <span className="inline-block w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: statusColor, animationDelay: '150ms' }}></span>
              <span className="inline-block w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: statusColor, animationDelay: '300ms' }}></span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {toolCall.duration !== undefined && (
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{toolCall.duration.toFixed(1)}s</span>
          )}
          {toolCall.status === 'success' && <span className="text-xs" style={{ color: statusColor }}>Completed</span>}
          {toolCall.status === 'error' && <span className="text-xs" style={{ color: statusColor }}>Failed</span>}
        </div>
      </div>

      {/* Input/Action */}
      <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
        {toolCall.action}
      </div>

      {/* Output (collapsible) */}
      {hasOutput && (
        <div>
          <button
            onClick={() => setOutputExpanded(!outputExpanded)}
            className="w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center gap-1"
            style={{
              color: 'var(--color-text-secondary)',
              backgroundColor: outputExpanded ? 'var(--color-hover-bg)' : 'transparent'
            }}
          >
            <span className="transform transition-transform" style={{ transform: outputExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            <span>Output</span>
            {!outputExpanded && toolCall.output && (
              <span style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}>
                ({toolCall.output.split('\n').length} lines)
              </span>
            )}
          </button>
          {outputExpanded && (
            <pre className="px-3 py-2 text-xs overflow-x-auto max-h-64 overflow-y-auto" style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-code-bg)' }}>
              <code>{toolCall.output}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
