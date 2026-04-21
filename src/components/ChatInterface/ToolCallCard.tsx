import { useState } from 'react'
import type { ToolCall } from './types'

const TOOL_ICONS: Record<string, string> = {
  Read: '📄',
  Edit: '✏️',
  Write: '📝',
  Bash: '⚡',
  Glob: '🔍',
  Grep: '🔎',
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
  const icon = TOOL_ICONS[toolCall.tool] || '🔧'
  const statusColor = TOOL_COLORS[toolCall.status]
  const hasOutput = toolCall.output && toolCall.output.length > 0

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
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{toolCall.tool}</span>
          {toolCall.status === 'running' && (
            <div className="flex gap-0.5">
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
          {toolCall.status === 'success' && <span className="text-xs" style={{ color: statusColor }}>✓</span>}
          {toolCall.status === 'error' && <span className="text-xs" style={{ color: statusColor }}>✗</span>}
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
            className="w-full px-3 py-1.5 text-left text-xs hover:opacity-80 transition-opacity flex items-center gap-1"
            style={{ color: 'var(--color-text-secondary)' }}
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
            <pre className="px-3 py-2 text-xs overflow-x-auto max-h-64 overflow-y-auto" style={{ color: 'var(--color-text)', backgroundColor: 'var(--color-bg)' }}>
              <code>{toolCall.output}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
