import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ThinkingBlock } from './ThinkingBlock'
import { ProcessSteps } from './ProcessSteps'
import type { ChatMessage } from './types'

interface AssistantMessageProps {
  message: ChatMessage
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const hasThinking = Boolean(message.thinking && message.thinking.length > 0)
  const hasToolCalls = Boolean(message.toolCalls && message.toolCalls.length > 0)
  const hasContent = Boolean(message.content && message.content.length > 0)
  const isStreaming = Boolean(message.isStreaming)
  const showFallback = isStreaming && !hasThinking && !hasToolCalls && !hasContent

  return (
    <div className="space-y-3">
      {hasThinking && (
        <ThinkingBlock
          thinking={message.thinking || ''}
          isActive={isStreaming && !hasContent}
          isComplete={Boolean(message.thinkingComplete)}
        />
      )}

      {hasToolCalls && (
        <ProcessSteps
          toolCalls={message.toolCalls || []}
          isActive={isStreaming}
        />
      )}

      {hasContent && (
        <div
          className="rounded-md border px-4 py-3"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <div className="text-xs leading-5" style={{ color: 'var(--color-text)' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: ({ className, children, ...props }: any) => {
                  const inline = !className?.includes('language-')
                  return !inline ? (
                    <pre className="rounded p-3 overflow-x-auto my-2" style={{ backgroundColor: 'var(--color-code-bg)', border: '1px solid var(--color-border)' }}>
                      <code className={className} style={{ color: 'var(--color-text)' }} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code className="px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--color-code-bg)', color: '#CE9178' }} {...props}>
                      {children}
                    </code>
                  )
                },
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1.5">{children}</ol>,
                li: ({ children }) => <li style={{ color: 'var(--color-text)' }}>{children}</li>,
                a: ({ href, children }) => (
                  <a href={href} className="hover:underline" style={{ color: '#4FC3F7' }} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                h1: ({ children }) => <h1 className="text-base font-semibold mb-3 mt-4" style={{ color: 'var(--color-text)' }}>{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 mt-3" style={{ color: 'var(--color-text)' }}>{children}</h2>,
                h3: ({ children }) => <h3 className="text-xs font-semibold mb-2 mt-2" style={{ color: 'var(--color-text)' }}>{children}</h3>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {showFallback && (
        <div className="flex items-center gap-2 text-xs px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
          <div className="flex gap-1" aria-hidden="true">
            <span className="inline-block w-1.5 h-1.5 bg-[#569CD6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="inline-block w-1.5 h-1.5 bg-[#569CD6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="inline-block w-1.5 h-1.5 bg-[#569CD6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span className="italic">{message.status || 'AI is thinking...'}</span>
        </div>
      )}
    </div>
  )
}
