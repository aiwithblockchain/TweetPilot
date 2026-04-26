import { useState, useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { aiService, type SessionMetadata, type StoredMessage } from '@/services/ai/tauri'
import { workspaceService } from '@/services/workspace'
import { AssistantMessage } from './ChatInterface/AssistantMessage'
import { SessionPanel } from './ChatInterface/SessionPanel'
import { Clock, Plus } from 'lucide-react'
import type { ChatMessage, ToolCall, PersistedToolCall } from './ChatInterface/types'

interface ChatInterfaceProps {
  onOpenSettings?: () => void
}

function fromPersistedToolCall(toolCall: PersistedToolCall): ToolCall {
  return {
    id: toolCall.id,
    tool: toolCall.tool,
    action: toolCall.action,
    input: toolCall.input ?? undefined,
    output: toolCall.output ?? undefined,
    status: toolCall.status === 'running'
      ? 'running'
      : toolCall.status === 'error' || toolCall.status === 'failed'
        ? 'error'
        : 'success',
    duration: toolCall.duration ?? undefined,
    startTime: toolCall.start_time,
    endTime: toolCall.end_time ?? undefined,
  }
}

function fromStoredMessage(message: StoredMessage, index: number): ChatMessage {
  return {
    id: message.id ?? `${message.role}-${message.timestamp}-${index}`,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    timestamp: message.timestamp,
    thinking: message.thinking ?? undefined,
    thinkingComplete: message.thinking_complete ?? undefined,
    toolCalls: message.tool_calls?.map(fromPersistedToolCall),
    status: message.status ?? undefined,
  }
}

function appendThinkingChunk(targetRequestId: string, chunk: string, activeRequestId: string | null, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, Array<{ type: 'thinking'; chunk: string } | { type: 'tool-start'; tool: string; action: string } | { type: 'tool-end'; tool: string; success: boolean; result: string }>>>>) {
  if (targetRequestId !== activeRequestId) {
    setPendingEvents((prev) => ({
      ...prev,
      [targetRequestId]: [...(prev[targetRequestId] || []), { type: 'thinking', chunk }],
    }))
    return
  }

  setMessages((prev) => {
    const lastMessage = prev[prev.length - 1]
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      const newThinking = (lastMessage.thinking || '') + chunk
      return [
        ...prev.slice(0, -1),
        { ...lastMessage, thinking: newThinking },
      ]
    }
    return prev
  })
}

function applyToolStart(targetRequestId: string, tool: string, action: string, activeRequestId: string | null, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, Array<{ type: 'thinking'; chunk: string } | { type: 'tool-start'; tool: string; action: string } | { type: 'tool-end'; tool: string; success: boolean; result: string }>>>>) {
  if (targetRequestId !== activeRequestId) {
    setPendingEvents((prev) => ({
      ...prev,
      [targetRequestId]: [...(prev[targetRequestId] || []), { type: 'tool-start', tool, action }],
    }))
    return
  }

  setMessages((prev) => {
    const lastMessage = prev[prev.length - 1]
    if (lastMessage && lastMessage.role === 'assistant') {
      const toolCalls = lastMessage.toolCalls || []
      const newToolCall: ToolCall = {
        id: `${tool}-${Date.now()}`,
        tool,
        action,
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

function applyToolEnd(targetRequestId: string, tool: string, success: boolean, result: string, activeRequestId: string | null, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, Array<{ type: 'thinking'; chunk: string } | { type: 'tool-start'; tool: string; action: string } | { type: 'tool-end'; tool: string; success: boolean; result: string }>>>>) {
  if (targetRequestId !== activeRequestId) {
    setPendingEvents((prev) => ({
      ...prev,
      [targetRequestId]: [...(prev[targetRequestId] || []), { type: 'tool-end', tool, success, result }],
    }))
    return
  }

  setMessages((prev) => {
    const lastMessage = prev[prev.length - 1]
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.toolCalls) {
      const toolCalls = lastMessage.toolCalls.map((tc) => {
        if (tc.tool === tool && tc.status === 'running') {
          const endTime = Date.now()
          const duration = (endTime - tc.startTime) / 1000
          return {
            ...tc,
            status: (success ? 'success' : 'error') as 'success' | 'error',
            output: result || '',
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
  const [pendingEvents, setPendingEvents] = useState<Record<string, Array<{ type: 'thinking'; chunk: string } | { type: 'tool-start'; tool: string; action: string } | { type: 'tool-end'; tool: string; success: boolean; result: string }>>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const assistantMessageIdRef = useRef<string | null>(null)
  const currentRequestIdRef = useRef<string | null>(null)
  const isComposingRef = useRef(false)
  const lastCompositionEndAtRef = useRef(0)

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

  // Load sessions list
  const loadSessions = async () => {
    if (!isConfigured) return
    try {
      const workingDir = await workspaceService.getCurrentWorkspace()
      if (!workingDir) {
        setSessions([])
        setMessages([])
        setCurrentSessionId(null)
        return
      }

      const sessionList = await aiService.listSessions(workingDir)
      setSessions(sessionList)
      setCurrentSessionId((prev) => {
        const stillExists = prev ? sessionList.some((session) => session.id === prev) : false
        if (!stillExists) {
          setMessages([])
          return null
        }
        return prev
      })
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  const resetChatState = () => {
    setMessages([])
    setCurrentSessionId(null)
    setCurrentRequestId(null)
    setIsLoading(false)
  }

  useEffect(() => {
    const refreshSessions = async () => {
      resetChatState()
      await loadSessions()
    }

    refreshSessions()
  }, [isConfigured])

  useEffect(() => {
    let disposed = false

    const setupWorkspaceChangedListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        const unlisten = await listen<string>('workspace-changed', () => {
          resetChatState()
          if (isConfigured) {
            void loadSessions()
          } else {
            setSessions([])
          }
        })

        if (disposed) {
          unlisten()
        }

        return unlisten
      } catch (error) {
        console.debug('[ChatInterface] workspace-changed listener unavailable', error)
        return () => {}
      }
    }

    const cleanup = setupWorkspaceChangedListener()
    return () => {
      disposed = true
      cleanup.then(unlisten => unlisten())
    }
  }, [isConfigured])

  useEffect(() => {
    currentRequestIdRef.current = currentRequestId
  }, [currentRequestId])

  // Set up event listeners
  useEffect(() => {
    console.log('[ChatInterface] Setting up event listeners')

    const unlistenChunk = aiService.onMessageChunk((data) => {
      console.log('[ChatInterface] Received message-chunk:', data)
      if (data.request_id === currentRequestIdRef.current) {
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
        console.log('[ChatInterface] Request ID mismatch:', data.request_id, 'vs', currentRequestIdRef.current)
      }
    })

    const unlistenThinkingChunk = aiService.onThinkingChunk((data) => {
      console.log('[ChatInterface] Received thinking-chunk:', data)
      appendThinkingChunk(data.request_id, data.chunk, currentRequestIdRef.current, setMessages, setPendingEvents)
    })

    const unlistenToolStart = aiService.onToolCallStart((data) => {
      console.log('[ChatInterface] Received tool-call-start:', data)
      applyToolStart(data.request_id, data.tool, data.action, currentRequestIdRef.current, setMessages, setPendingEvents)
    })

    const unlistenToolEnd = aiService.onToolCallEnd((data) => {
      console.log('[ChatInterface] Received tool-call-end:', data)
      applyToolEnd(data.request_id, data.tool, data.success, data.result || '', currentRequestIdRef.current, setMessages, setPendingEvents)
    })

    const unlistenAiStatus = aiService.onAiStatus((data) => {
      console.log('[ChatInterface] Received ai-status:', data)
      if (data.request_id === currentRequestIdRef.current) {
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
      if (data.request_id === currentRequestIdRef.current) {
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
  }, [toast])

  useEffect(() => {
    if (!currentRequestId) {
      return
    }

    const queuedEvents = pendingEvents[currentRequestId]
    if (!queuedEvents || queuedEvents.length === 0) {
      return
    }

    queuedEvents.forEach((event) => {
      if (event.type === 'thinking') {
        appendThinkingChunk(currentRequestId, event.chunk, currentRequestId, setMessages, setPendingEvents)
      } else if (event.type === 'tool-start') {
        applyToolStart(currentRequestId, event.tool, event.action, currentRequestId, setMessages, setPendingEvents)
      } else {
        applyToolEnd(currentRequestId, event.tool, event.success, event.result, currentRequestId, setMessages, setPendingEvents)
      }
    })

    setPendingEvents((prev) => {
      const next = { ...prev }
      delete next[currentRequestId]
      return next
    })
  }, [currentRequestId, pendingEvents])

  const handleSend = async () => {
    console.log('[ChatInterface] handleSend called', {
      valueLength: value.length,
      isLoading,
      isConfigured,
      currentSessionId,
    })

    if (!value.trim() || isLoading) return

    if (!isConfigured) {
      toast.error('Please configure AI settings first')
      return
    }

    if (!currentSessionId) {
      toast.error('请先从历史会话中选择，或点击右上角 + 新建会话')
      return
    }

    const workingDir = await workspaceService.getCurrentWorkspace()
    if (!workingDir) {
      toast.error('请先选择工作区')
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
      console.log('[ChatInterface] About to call aiService.sendMessage')
      const response = await aiService.sendMessage(userMessage.content, workingDir)
      console.log('[ChatInterface] Received request ID:', response.request_id)
      setCurrentRequestId(response.request_id)
    } catch (error) {
      console.error('[ChatInterface] Failed to send message:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`发送消息失败: ${errorMessage}`, 8000)
      setIsLoading(false)
      setCurrentRequestId(null)
      setMessages((prev) => prev.slice(0, -2))
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

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const nativeEvent = e.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number }
    const justEndedComposition = Date.now() - lastCompositionEndAtRef.current < 50

    if (isComposingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229 || justEndedComposition) {
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSelectSession = async (sessionId: string) => {
    try {
      const workingDir = await workspaceService.getCurrentWorkspace()
      if (!workingDir) {
        toast.error('请先选择工作区')
        return
      }

      const loadedSession = await aiService.loadSession(workingDir, sessionId)
      const loadedMessages = loadedSession.messages.map(fromStoredMessage)
      setMessages(loadedMessages)
      setCurrentSessionId(loadedSession.session.id)
      setShowSessionPanel(false)
      await loadSessions()

      try {
        await aiService.activateSession(sessionId, workingDir)
        toast.success('会话已加载')
      } catch (error) {
        console.error('Failed to activate session runtime:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        toast.warning(`会话历史已加载，但当前无法继续对话: ${errorMessage}`)
      }
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
      const workingDir = await workspaceService.getCurrentWorkspace()
      if (!workingDir) {
        toast.error('请先选择工作区')
        return
      }

      await aiService.deleteSession(workingDir, sessionId)
      await loadSessions()

      if (sessionId === currentSessionId) {
        setMessages([])
        setCurrentSessionId(null)
        setShowSessionPanel(false)
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
        {!currentSessionId ? (
          <div className="text-xs text-[var(--color-text-secondary)] text-center py-8 space-y-2">
            <div>尚未选择会话</div>
            <div>点击右上角 + 新建会话，或打开历史记录选择一个已有会话。</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-xs text-[var(--color-text-secondary)] text-center py-8">
            当前会话暂无消息，输入内容开始对话。
          </div>
        ) : null}

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
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
            lastCompositionEndAtRef.current = Date.now()
          }}
          onKeyDown={handleKeyDown}
          placeholder={currentSessionId ? '输入消息...' : '请先选择历史会话，或点击右上角 + 新建会话'}
          disabled={isLoading || !currentSessionId}
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
              disabled={isLoading || !value.trim() || !currentSessionId}
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
