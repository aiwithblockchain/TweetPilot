import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Brain, ChevronRight, Wrench } from 'lucide-react'
import type { AssistantTimelineItem, ChatMessage } from './types'

interface AssistantMessageProps {
  message: ChatMessage
}

function renderMarkdown(content: string) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: ({ className, children, ...props }: any) => {
          const inline = !className?.includes('language-')
          return !inline ? (
            <pre className="my-2 overflow-x-auto rounded p-3" style={{ backgroundColor: 'var(--color-code-bg)', border: '1px solid var(--color-border)' }}>
              <code className={className} style={{ color: 'var(--color-text)' }} {...props}>
                {children}
              </code>
            </pre>
          ) : (
            <code className="rounded px-1.5 py-0.5 font-mono" style={{ backgroundColor: 'var(--color-code-bg)', color: '#CE9178' }} {...props}>
              {children}
            </code>
          )
        },
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 list-inside list-disc space-y-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-inside list-decimal space-y-1.5">{children}</ol>,
        li: ({ children }) => <li style={{ color: 'var(--color-text)' }}>{children}</li>,
        a: ({ href, children }) => (
          <a href={href} className="transition-opacity hover:opacity-80" style={{ color: '#4FC3F7' }} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        h1: ({ children }) => <h1 className="mb-3 mt-4 text-base font-semibold" style={{ color: 'var(--color-text)' }}>{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 mt-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 mt-2 text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{children}</h3>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function TimelineThinkingItem({ item }: { item: Extract<AssistantTimelineItem, { type: 'thinking' }> }) {
  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{
        borderColor: item.isActive ? '#569CD6' : 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <Brain size={14} style={{ color: '#569CD6' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Thinking</span>
        {item.isActive ? (
          <div className="flex gap-0.5" aria-hidden="true">
            <span className="inline-block h-1 w-1 rounded-full animate-bounce bg-[#569CD6]" style={{ animationDelay: '0ms' }}></span>
            <span className="inline-block h-1 w-1 rounded-full animate-bounce bg-[#569CD6]" style={{ animationDelay: '150ms' }}></span>
            <span className="inline-block h-1 w-1 rounded-full animate-bounce bg-[#569CD6]" style={{ animationDelay: '300ms' }}></span>
          </div>
        ) : item.isComplete ? (
          <span className="text-xs" style={{ color: '#4EC9B0' }}>Completed</span>
        ) : null}
      </div>
      <div className="px-3 py-2 text-xs whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
        {item.content}
      </div>
    </div>
  )
}

function TimelineToolItem({ item }: { item: Extract<AssistantTimelineItem, { type: 'tool' }> }) {
  const { toolCall } = item
  const statusColor = toolCall.status === 'running' ? '#569CD6' : toolCall.status === 'success' ? '#4EC9B0' : '#F48771'
  const hasOutput = Boolean(toolCall.output && toolCall.output.length > 0)

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{
        borderColor: toolCall.status === 'running' ? statusColor : 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <Wrench size={14} style={{ color: statusColor }} />
          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>{toolCall.tool}</span>
          <span className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide" style={{ color: statusColor, borderColor: statusColor }}>
            {toolCall.status}
          </span>
        </div>
        {toolCall.duration !== undefined && (
          <span className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)' }}>{toolCall.duration.toFixed(1)}s</span>
        )}
      </div>
      <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {toolCall.action}
      </div>
      {hasOutput && (
        <pre className="max-h-64 overflow-auto border-t px-3 py-2 text-xs" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-code-bg)', color: 'var(--color-text)' }}>
          <code>{toolCall.output}</code>
        </pre>
      )}
    </div>
  )
}

function TimelineTextItem({ item }: { item: Extract<AssistantTimelineItem, { type: 'text' }> }) {
  return (
    <div
      className="rounded-md border px-4 py-3"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div className="text-xs leading-5" style={{ color: 'var(--color-text)' }}>
        {renderMarkdown(item.content)}
      </div>
    </div>
  )
}

function TimelineFallback({ status }: { status?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
      <ChevronRight size={14} style={{ color: '#569CD6' }} />
      <span className="italic">{status || 'AI is thinking...'}</span>
    </div>
  )
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const timeline = message.timeline || []
  const hasTimeline = timeline.length > 0
  const showFallback = Boolean(message.isStreaming) && !hasTimeline

  return (
    <div className="space-y-3">
      {timeline.map((item) => {
        if (item.type === 'thinking') {
          return <TimelineThinkingItem key={item.id} item={item} />
        }
        if (item.type === 'tool') {
          return <TimelineToolItem key={item.id} item={item} />
        }
        return <TimelineTextItem key={item.id} item={item} />
      })}

      {showFallback && <TimelineFallback status={message.status} />}
    </div>
  )
}
