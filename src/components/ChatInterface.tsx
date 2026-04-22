import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { aiService, type SessionMetadata } from '@/services/ai/tauri'
import { workspaceService } from '@/services'
import { AssistantMessage } from './ChatInterface/AssistantMessage'
import { SessionPanel } from './ChatInterface/SessionPanel'
import { Clock, Plus } from 'lucide-react'
import type { ChatMessage, ToolCall } from './ChatInterface/types'

interface ChatInterfaceProps {
  onOpenSettings?: () => void
}

export function ChatInterface({ onOpenSettings }: ChatInterfaceProps = {}) {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionMetadata[]>([])
  const [showSessionPanel, setShowSessionPanel] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const assistantMessageIdRef = useRef<string | null>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check if AI is configured
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const settings = await aiService.getConfig()
        const activeProvider = settings.providers.find(p => p.id === settings.active_provider)
        setIsConfigured(!!activeProvider && !!activeProvider.api_key)
      } catch (error) {
        console.error('Failed to check AI config:', error)
        toast.error('Failed to load AI configuration')
      }
    }
    checkConfig()
  }, [toast])

  // Initialize AI session
  useEffect(() => {
    const initSession = async () => {
      if (!isConfigured) return

      try {
        const workingDir = await workspaceService.getCurrentWorkspace()
        if (!workingDir) {
          console.warn('[ChatInterface] No workspace selected, skipping AI session initialization')
          return
        }
        console.log('[ChatInterface] Initializing AI session with workingDir:', workingDir)
        const sessionId = await aiService.initSession(workingDir)
        setCurrentSessionId(sessionId)
        console.log('[ChatInterface] AI session initialized successfully')
      } catch (error) {
        console.error('[ChatInterface] Failed to initialize AI session:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        toast.error(`AI 会话初始化失败: ${errorMessage}`, 8000)
      }
    }
    initSession()
  }, [isConfigured, toast])

  // Load sessions list
  const loadSessions = async () => {
    if (!isConfigured) return
    try {
      const sessionList = await aiService.listSessions()
      setSessions(sessionList)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [isConfigured])

  // Set up event listeners
  useEffect(() => {
    console.log('[ChatInterface] Setting up event listeners, currentRequestId:', currentRequestId)

    const unlistenChunk = aiService.onMessageChunk((data) => {
      console.log('[ChatInterface] Received message-chunk:', data)
      if (data.request_id === currentRequestId) {
        console.log('[ChatInterface] Request ID matches, updating message')
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, content: lastMessage.content + data.chunk },
            ]
          }
          return prev
        })
      } else {
        console.log('[ChatInterface] Request ID mismatch:', data.request_id, 'vs', currentRequestId)
      }
    })

    const unlistenThinkingChunk = aiService.onThinkingChunk((data) => {
      console.log('[ChatInterface] Received thinking-chunk:', data)
      if (data.request_id === currentRequestId) {
        console.log('[ChatInterface] Appending thinking chunk, current length:', (messages[messages.length - 1]?.thinking || '').length)
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            const newThinking = (lastMessage.thinking || '') + data.chunk
            console.log('[ChatInterface] New thinking length:', newThinking.length)
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, thinking: newThinking },
            ]
          }
          return prev
        })
      }
    })

    const unlistenToolStart = aiService.onToolCallStart((data) => {
      console.log('[ChatInterface] Received tool-call-start:', data)
      if (data.request_id === currentRequestId) {
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.role === 'assistant') {
            const toolCalls = lastMessage.toolCalls || []
            const newToolCall: ToolCall = {
              id: `${data.tool}-${Date.now()}`,
              tool: data.tool,
              action: data.action,
              status: 'running',
              startTime: Date.now(),
            }
            return [
              ...prev.slice(0, -1),
              {
                ...lastMessage,
                toolCalls: [...toolCalls, newToolCall],
              },
            ]
          }
          return prev
        })
      }
    })

    const unlistenToolEnd = aiService.onToolCallEnd((data) => {
      console.log('[ChatInterface] Received tool-call-end:', data)
      if (data.request_id === currentRequestId) {
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.toolCalls) {
            const toolCalls = lastMessage.toolCalls.map((tc) => {
              if (tc.tool === data.tool && tc.status === 'running') {
                const endTime = Date.now()
                const duration = (endTime - tc.startTime) / 1000
                return {
                  ...tc,
                  status: (data.success ? 'success' : 'error') as 'success' | 'error',
                  output: data.result || '',
                  duration,
                  endTime,
                }
              }
              return tc
            })
            return [...prev.slice(0, -1), { ...lastMessage, toolCalls }]
          }
          return prev
        })
      }
    })

    const unlistenAiStatus = aiService.onAiStatus((data) => {
      console.log('[ChatInterface] Received ai-status:', data)
      if (data.request_id === currentRequestId) {
        console.log('[ChatInterface] Updating status to:', data.text)
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            return [...prev.slice(0, -1), { ...lastMessage, status: data.text }]
          }
          return prev
        })
      }
    })

    const unlistenRequestEnd = aiService.onRequestEnd((data) => {
      console.log('[ChatInterface] Received ai-request-end:', data)
      if (data.request_id === currentRequestId) {
        console.log('[ChatInterface] Request completed, cleaning up')
        setIsLoading(false)
        setCurrentRequestId(null)

        if (data.result === 'error' || data.result === 'cancelled') {
          if (data.error) {
            toast.error(data.error, 8000)
          }
          setMessages((prev) => prev.filter((message) => message.id !== assistantMessageIdRef.current))
          return
        }

        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1]
          if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
            return [...prev.slice(0, -1), { ...lastMessage, isStreaming: false, status: undefined }]
          }
          return prev
        })
      }
    })

    return () => {
      Promise.all([
        unlistenChunk,
        unlistenThinkingChunk,
        unlistenToolStart,
        unlistenToolEnd,
        unlistenAiStatus,
        unlistenRequestEnd,
      ]).then(fns => fns.forEach(fn => fn()))
    }
  }, [currentRequestId])

  const handleSend = async () => {
    if (!value.trim() || isLoading) return

    if (!isConfigured) {
      toast.error('Please configure AI settings first')
      return
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: value.trim(),
      timestamp: Date.now(),
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    }

    assistantMessageIdRef.current = assistantMessage.id

    console.log('[ChatInterface] Sending message:', userMessage.content)
    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setValue('')
    setIsLoading(true)

    try {
      const requestId = await aiService.sendMessage(userMessage.content)
      console.log('[ChatInterface] Received request ID:', requestId)
      setCurrentRequestId(requestId)
    } catch (error) {
      console.error('[ChatInterface] Failed to send message:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`发送消息失败: ${errorMessage}`, 8000)
      setIsLoading(false)
      setCurrentRequestId(null)
      setMessages((prev) => prev.slice(0, -1))
    }
  }

  const handleCancel = async () => {
    try {
      await aiService.cancelMessage()
      setIsLoading(false)
      setCurrentRequestId(null)
    } catch (error) {
      console.error('Failed to cancel message:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSelectSession = async (sessionId: string) => {
    try {
      const storedMessages = await aiService.loadSession(sessionId)
      const loadedMessages: ChatMessage[] = storedMessages.map((m, index) => ({
        id: `${m.role}-${m.timestamp}-${index}`,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      }))
      setMessages(loadedMessages)
      setCurrentSessionId(sessionId)
      setShowSessionPanel(false)
      await loadSessions()
      toast.success('会话已加载')
    } catch (error) {
      console.error('Failed to load session:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`加载会话失败: ${errorMessage}`)
    }
  }

  const handleNewSession = async () => {
    try {
      const workingDir = await workspaceService.getCurrentWorkspace()
      if (!workingDir) {
        toast.error('请先选择工作区')
        return
      }
      const sessionId = await aiService.createNewSession(workingDir)
      setMessages([])
      setCurrentSessionId(sessionId)
      setShowSessionPanel(false)
      await loadSessions()
      toast.success('新会话已创建')
    } catch (error) {
      console.error('Failed to create session:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`创建会话失败: ${errorMessage}`)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('确定要删除这个会话吗？')) return

    try {
      await aiService.deleteSession(sessionId)
      await loadSessions()

      if (sessionId === currentSessionId) {
        await handleNewSession()
      }

      toast.success('会话已删除')
    } catch (error) {
      console.error('Failed to delete session:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`删除会话失败: ${errorMessage}`)
    }
  }

  if (!isConfigured) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[var(--color-surface)] p-6">
        <div className="text-center max-w-md">
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">
            AI Not Configured
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">
            Please configure your API key and model in Settings to start using AI features.
          </p>
          <button
            onClick={() => onOpenSettings?.()}
            className="px-4 py-2 bg-[#007ACC] text-white text-xs rounded hover:bg-[#1485D1] transition-colors"
          >
            Configure AI
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface)] relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          {currentSessionId && sessions.length > 0 && (
            <span className="text-xs font-medium text-[var(--color-text)]">
              {sessions.find(s => s.id === currentSessionId)?.title || ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSessionPanel(!showSessionPanel)}
            className="p-1.5 hover:bg-[var(--color-bg)] rounded transition-colors"
            title="会话历史"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Clock size={16} />
          </button>
          <button
            onClick={handleNewSession}
            className="p-1.5 hover:bg-[var(--color-bg)] rounded transition-colors"
            title="新建会话"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Session Panel */}
      {showSessionPanel && (
        <SessionPanel
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClose={() => setShowSessionPanel(false)}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-[var(--color-text-secondary)] text-center py-8">
            你好，我是 TweetPilot。我可以帮助你理解和使用当前目录下的 Python 脚本。
          </div>
        )}

        {messages.map((message) => {
          return (
            <div key={message.id} className="space-y-2">
              {/* User message */}
              {message.role === 'user' && (
                <div className="rounded-md px-3 py-2 text-xs leading-5 bg-[#007ACC] text-white ml-auto inline-block max-w-[85%]">
                  {message.content}
                </div>
              )}

              {/* Assistant message */}
              {message.role === 'assistant' && (
                <AssistantMessage message={message} />
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--color-border)] p-3 space-y-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          disabled={isLoading}
          className="w-full min-h-[84px] resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none focus:border-[#007ACC] disabled:opacity-50"
        />

        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            {isLoading && (
              <button
                onClick={handleCancel}
                className="h-7 px-3 rounded bg-[var(--color-bg)] text-[var(--color-text)] text-xs hover:bg-[var(--color-border)] transition-colors"
              >
                取消
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={isLoading || !value.trim()}
              className="h-7 px-3 rounded bg-[#007ACC] text-white text-xs hover:bg-[#1485D1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
