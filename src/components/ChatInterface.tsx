import { useState, useEffect, useRef, useCallback } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useToast } from '@/contexts/ToastContext'
import { aiService, type SessionMetadata, type StoredMessage } from '@/services/ai/tauri'
import { workspaceService } from '@/services/workspace'
import { AssistantMessage } from './ChatInterface/AssistantMessage'
import { SessionPanel } from './ChatInterface/SessionPanel'
import { Clock, Plus } from 'lucide-react'
import type {
  AssistantTimelineItem,
  ChatMessage,
  PersistedToolCall,
  ToolCall,
} from './ChatInterface/types'

const PANEL_REOPEN_EVENT = 'tweetpilot-ai-panel-reopened'

interface ChatInterfaceProps {
  onOpenSettings?: () => void
}

type PendingEvent =
  | { type: 'thinking'; chunk: string }
  | { type: 'tool-start'; tool: string; action: string }
  | { type: 'tool-end'; tool: string; success: boolean; result: string }
  | { type: 'text'; chunk: string }
  | { type: 'status'; text: string }

interface RequestEndPayload {
  request_id: string
  result: string
  final_text?: string
  error?: string
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

function buildTimelineFromStoredMessage(message: StoredMessage): AssistantTimelineItem[] {
  const toolCalls = message.tool_calls?.map(fromPersistedToolCall) || []
  const toolCallMap = new Map(toolCalls.map((toolCall) => [toolCall.id, toolCall]))
  const persistedTimeline = message.timeline || []

  if (persistedTimeline.length > 0) {
    return persistedTimeline.flatMap((item): AssistantTimelineItem[] => {
      if (item.type === 'thinking') {
        return [{
          id: item.id,
          type: 'thinking',
          content: item.content,
          isComplete: item.is_complete ?? true,
          isActive: !(item.is_complete ?? true),
        }]
      }

      if (item.type === 'tool') {
        const toolCall = toolCallMap.get(item.tool_call_id)
        return toolCall
          ? [{
              id: item.id,
              type: 'tool',
              toolCall,
            }]
          : []
      }

      return [{
        id: item.id,
        type: 'text',
        content: item.content,
      }]
    })
  }

  const timeline: AssistantTimelineItem[] = []

  if (message.thinking) {
    timeline.push({
      id: `${message.id ?? 'assistant'}-thinking`,
      type: 'thinking',
      content: message.thinking,
      isComplete: message.thinking_complete ?? true,
      isActive: !(message.thinking_complete ?? true),
    })
  }

  if (toolCalls.length) {
    timeline.push(
      ...toolCalls.map((toolCall) => ({
        id: `${message.id ?? 'assistant'}-tool-${toolCall.id}`,
        type: 'tool' as const,
        toolCall,
      })),
    )
  }

  if (message.content) {
    timeline.push({
      id: `${message.id ?? 'assistant'}-text`,
      type: 'text',
      content: message.content,
    })
  }

  return timeline
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
    timeline: message.role === 'assistant' ? buildTimelineFromStoredMessage(message) : undefined,
  }
}

function queuePendingEvent(targetRequestId: string, event: PendingEvent, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, PendingEvent[]>>>) {
  setPendingEvents((prev) => ({
    ...prev,
    [targetRequestId]: [...(prev[targetRequestId] || []), event],
  }))
}

function updateStreamingAssistant(
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  updater: (message: ChatMessage) => ChatMessage,
) {
  setMessages((prev) => {
    const lastMessage = prev[prev.length - 1]
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
      return [...prev.slice(0, -1), updater(lastMessage)]
    }
    return prev
  })
}

function appendThinkingChunk(targetRequestId: string, chunk: string, activeRequestId: string | null, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, PendingEvent[]>>>) {
  if (targetRequestId !== activeRequestId) {
    queuePendingEvent(targetRequestId, { type: 'thinking', chunk }, setPendingEvents)
    return
  }

  updateStreamingAssistant(setMessages, (lastMessage) => {
    const timeline = [...(lastMessage.timeline || [])]
    const lastTimelineItem = timeline[timeline.length - 1]
    const newThinking = (lastMessage.thinking || '') + chunk

    if (lastTimelineItem?.type === 'thinking' && lastTimelineItem.isActive) {
      timeline[timeline.length - 1] = {
        ...lastTimelineItem,
        content: lastTimelineItem.content + chunk,
      }
    } else {
      timeline.push({
        id: `${lastMessage.id}-thinking-${timeline.length}`,
        type: 'thinking',
        content: chunk,
        isActive: true,
        isComplete: false,
      })
    }

    return {
      ...lastMessage,
      thinking: newThinking,
      timeline,
    }
  })
}

function applyToolStart(targetRequestId: string, tool: string, action: string, activeRequestId: string | null, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, PendingEvent[]>>>) {
  if (targetRequestId !== activeRequestId) {
    queuePendingEvent(targetRequestId, { type: 'tool-start', tool, action }, setPendingEvents)
    return
  }

  updateStreamingAssistant(setMessages, (lastMessage) => {
    const toolCalls = lastMessage.toolCalls || []
    const timeline = [...(lastMessage.timeline || [])]
    const newToolCall: ToolCall = {
      id: `${tool}-${Date.now()}`,
      tool,
      action,
      status: 'running',
      startTime: Date.now(),
    }

    const updatedTimeline = timeline.map((item) =>
      item.type === 'thinking' && item.isActive
        ? { ...item, isActive: false, isComplete: true }
        : item,
    )

    updatedTimeline.push({
      id: `${lastMessage.id}-tool-${newToolCall.id}`,
      type: 'tool',
      toolCall: newToolCall,
    })

    return {
      ...lastMessage,
      toolCalls: [...toolCalls, newToolCall],
      timeline: updatedTimeline,
    }
  })
}

function applyToolEnd(targetRequestId: string, tool: string, success: boolean, result: string, activeRequestId: string | null, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, PendingEvent[]>>>) {
  if (targetRequestId !== activeRequestId) {
    queuePendingEvent(targetRequestId, { type: 'tool-end', tool, success, result }, setPendingEvents)
    return
  }

  updateStreamingAssistant(setMessages, (lastMessage) => {
    const toolCalls = (lastMessage.toolCalls || []).map((tc) => {
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

    const timeline = (lastMessage.timeline || []).map((item) => {
      if (item.type === 'tool' && item.toolCall.tool === tool && item.toolCall.status === 'running') {
        const endTime = Date.now()
        const duration = (endTime - item.toolCall.startTime) / 1000
        return {
          ...item,
          toolCall: {
            ...item.toolCall,
            status: (success ? 'success' : 'error') as 'success' | 'error',
            output: result || '',
            duration,
            endTime,
          },
        }
      }
      return item
    })

    return {
      ...lastMessage,
      toolCalls,
      timeline,
    }
  })
}

function appendTextChunk(targetRequestId: string, chunk: string, activeRequestId: string | null, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, PendingEvent[]>>>) {
  if (targetRequestId !== activeRequestId) {
    queuePendingEvent(targetRequestId, { type: 'text', chunk }, setPendingEvents)
    return
  }

  updateStreamingAssistant(setMessages, (lastMessage) => {
    const timeline = [...(lastMessage.timeline || [])]
    const updatedTimeline = timeline.map((item) =>
      item.type === 'thinking' && item.isActive
        ? { ...item, isActive: false, isComplete: true }
        : item,
    )
    const lastTimelineItem = updatedTimeline[updatedTimeline.length - 1]

    if (lastTimelineItem?.type === 'text') {
      updatedTimeline[updatedTimeline.length - 1] = {
        ...lastTimelineItem,
        content: lastTimelineItem.content + chunk,
      }
    } else {
      updatedTimeline.push({
        id: `${lastMessage.id}-text-${updatedTimeline.length}`,
        type: 'text',
        content: chunk,
      })
    }

    return {
      ...lastMessage,
      content: lastMessage.content + chunk,
      timeline: updatedTimeline,
    }
  })
}

function applyStatus(targetRequestId: string, text: string, activeRequestId: string | null, setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>, setPendingEvents: React.Dispatch<React.SetStateAction<Record<string, PendingEvent[]>>>) {
  if (targetRequestId !== activeRequestId) {
    queuePendingEvent(targetRequestId, { type: 'status', text }, setPendingEvents)
    return
  }

  updateStreamingAssistant(setMessages, (lastMessage) => ({
    ...lastMessage,
    status: text,
  }))
}

function finalizeStreamingRequest(
  data: RequestEndPayload,
  assistantMessageId: string | null,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setCurrentRequestId: React.Dispatch<React.SetStateAction<string | null>>,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  toast: ReturnType<typeof useToast>,
) {
  console.log('[ChatInterface] Request completed, cleaning up')
  setIsLoading(false)
  setCurrentRequestId(null)

  setMessages((prev) => {
    const lastMessage = prev[prev.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant' || lastMessage.id !== assistantMessageId) {
      return prev
    }

    if (data.result === 'error') {
      if (data.error) {
        toast.error(data.error, 8000)
      }
      return prev.filter((message) => message.id !== assistantMessageId)
    }

    if (!lastMessage.isStreaming) {
      return prev
    }

    const timeline = (lastMessage.timeline || []).map((item) =>
      item.type === 'thinking' && item.isActive
        ? { ...item, isActive: false, isComplete: data.result !== 'cancelled' }
        : item,
    )

    const hasVisibleContent = Boolean(
      lastMessage.content.trim()
      || lastMessage.thinking?.trim()
      || lastMessage.toolCalls?.length
      || timeline.length,
    )

    if (data.result === 'cancelled' && !hasVisibleContent) {
      return prev.filter((message) => message.id !== assistantMessageId)
    }

    const nextMessage: ChatMessage = {
      ...lastMessage,
      isStreaming: false,
      status: data.result === 'cancelled' ? 'cancelled' : undefined,
      thinkingComplete: data.result === 'cancelled' ? false : true,
      timeline,
    }

    return [...prev.slice(0, -1), nextMessage]
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
  const [stopRequested, setStopRequested] = useState(false)
  const [pendingEvents, setPendingEvents] = useState<Record<string, PendingEvent[]>>({})
  const [pendingRequestEnds, setPendingRequestEnds] = useState<Record<string, RequestEndPayload>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const assistantMessageIdRef = useRef<string | null>(null)
  const currentRequestIdRef = useRef<string | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const sessionLoadRequestIdRef = useRef(0)
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
  const loadSessions = useCallback(async (preferredSessionId?: string | null) => {
    if (!isConfigured) return

    const requestId = ++sessionLoadRequestIdRef.current

    try {
      const workingDir = await workspaceService.getCurrentWorkspace()
      if (requestId !== sessionLoadRequestIdRef.current) {
        return
      }

      if (!workingDir) {
        setSessions([])
        setMessages([])
        setCurrentSessionId(null)
        return
      }

      const sessionList = await aiService.listSessions(workingDir)
      if (requestId !== sessionLoadRequestIdRef.current) {
        return
      }

      setSessions(sessionList)
      setCurrentSessionId((prev) => {
        const nextSessionId = preferredSessionId ?? prev
        const stillExists = nextSessionId ? sessionList.some((session) => session.id === nextSessionId) : false
        if (!stillExists) {
          setMessages([])
          return null
        }
        return nextSessionId
      })
    } catch (error) {
      if (requestId !== sessionLoadRequestIdRef.current) {
        return
      }
      console.error('Failed to load sessions:', error)
    }
  }, [isConfigured])

  const resetChatState = useCallback(() => {
    sessionLoadRequestIdRef.current += 1
    assistantMessageIdRef.current = null
    currentRequestIdRef.current = null
    setMessages([])
    setCurrentSessionId(null)
    setCurrentRequestId(null)
    setIsLoading(false)
    setStopRequested(false)
  }, [])

  const refreshCurrentSessionMetadata = useCallback(async () => {
    const activeSessionId = currentSessionIdRef.current
    if (!activeSessionId || !isConfigured) {
      return
    }

    const workingDir = await workspaceService.getCurrentWorkspace()
    if (!workingDir) {
      return
    }

    try {
      const metadata = await aiService.getSessionMetadata(workingDir, activeSessionId)
      if (!metadata) {
        return
      }

      setSessions((prev) => {
        const existingIndex = prev.findIndex((session) => session.id === activeSessionId)
        if (existingIndex === -1) {
          return prev
        }

        const next = [...prev]
        next[existingIndex] = metadata
        return next
      })
    } catch (error) {
      console.error('Failed to refresh session metadata:', error)
    }
  }, [isConfigured])


  const handleMissingSessionInWorkspace = async () => {
    resetChatState()
    setSessions([])
    await loadSessions()
    toast.error('当前工作区中找不到该会话，已刷新会话列表')
  }

  const hydrateSession = useCallback(async (sessionId: string, options?: { showHistoryOnComplete?: boolean }) => {
    const workingDir = await workspaceService.getCurrentWorkspace()
    if (!workingDir) {
      resetChatState()
      setSessions([])
      return false
    }

    try {
      const loadedSession = await aiService.loadSession(workingDir, sessionId)
      const loadedMessages = loadedSession.messages.map(fromStoredMessage)
      setMessages(loadedMessages)
      setCurrentSessionId(loadedSession.session.id)
      setStopRequested(false)
      setShowSessionPanel(options?.showHistoryOnComplete ?? false)
      await loadSessions(loadedSession.session.id)
      return true
    } catch (error) {
      console.error('Failed to hydrate session:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Failed to load AI session metadata: Query returned no rows')) {
        await handleMissingSessionInWorkspace()
        return false
      }
      toast.error(`加载会话失败: ${errorMessage}`)
      return false
    }
  }, [loadSessions, resetChatState, toast])

  useEffect(() => {
    if (!isConfigured) {
      resetChatState()
      setSessions([])
      return
    }

    void loadSessions()
  }, [isConfigured])

  useEffect(() => {
    let disposed = false
    let resolvedUnlisten: null | (() => void) = null

    const setupWorkspaceChangedListener = async () => {
      try {
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
          return
        }

        resolvedUnlisten = unlisten
      } catch (error) {
        console.debug('[ChatInterface] workspace-changed listener unavailable', error)
      }
    }

    void setupWorkspaceChangedListener()
    return () => {
      disposed = true
      resolvedUnlisten?.()
      resolvedUnlisten = null
    }
  }, [isConfigured])

  useEffect(() => {
    let disposed = false
    let resolvedUnlisten: null | (() => void) = null

    const setupPanelReopenedListener = async () => {
      try {
        const unlisten = await listen(PANEL_REOPEN_EVENT, async () => {
          if (currentRequestIdRef.current || currentSessionIdRef.current) {
            setShowSessionPanel(false)
            return
          }

          const workingDir = await workspaceService.getCurrentWorkspace()
          if (!workingDir) {
            setShowSessionPanel(false)
            return
          }

          const sessionList = await aiService.listSessions(workingDir)
          setSessions(sessionList)
          setShowSessionPanel(sessionList.length > 0)
        })

        if (disposed) {
          unlisten()
          return
        }

        resolvedUnlisten = unlisten
      } catch (error) {
        console.debug('[ChatInterface] panel reopen listener unavailable', error)
      }
    }

    void setupPanelReopenedListener()
    return () => {
      disposed = true
      resolvedUnlisten?.()
      resolvedUnlisten = null
    }
  }, [isConfigured])

  useEffect(() => {
    currentRequestIdRef.current = currentRequestId
  }, [currentRequestId])

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  useEffect(() => {
    if (!currentSessionId) {
      setShowSessionPanel(false)
    }
  }, [currentSessionId])

  useEffect(() => {
    console.log('[ChatInterface] Setting up event listeners')

    let disposed = false
    const cleanupFns: Array<() => void> = []

    const registerListeners = async () => {
      const [unlistenChunk, unlistenThinkingChunk, unlistenToolStart, unlistenToolEnd, unlistenAiStatus, unlistenRequestEnd] = await Promise.all([
        aiService.onMessageChunk((data) => {
          console.log('[ChatInterface] Received message-chunk:', data)
          appendTextChunk(data.request_id, data.chunk, currentRequestIdRef.current, setMessages, setPendingEvents)
        }),
        aiService.onThinkingChunk((data) => {
          console.log('[ChatInterface] Received thinking-chunk:', data)
          appendThinkingChunk(data.request_id, data.chunk, currentRequestIdRef.current, setMessages, setPendingEvents)
        }),
        aiService.onToolCallStart((data) => {
          console.log('[ChatInterface] Received tool-call-start:', data)
          applyToolStart(data.request_id, data.tool, data.action, currentRequestIdRef.current, setMessages, setPendingEvents)
        }),
        aiService.onToolCallEnd((data) => {
          console.log('[ChatInterface] Received tool-call-end:', data)
          applyToolEnd(data.request_id, data.tool, data.success, data.result || '', currentRequestIdRef.current, setMessages, setPendingEvents)
        }),
        aiService.onAiStatus((data) => {
          console.log('[ChatInterface] Received ai-status:', data)
          applyStatus(data.request_id, data.text, currentRequestIdRef.current, setMessages, setPendingEvents)
        }),
        aiService.onRequestEnd((data) => {
          console.log('[ChatInterface] Received ai-request-end:', data)
          if (data.request_id !== currentRequestIdRef.current) {
            setPendingRequestEnds((prev) => ({
              ...prev,
              [data.request_id]: data,
            }))
            return
          }

          finalizeStreamingRequest(
            data,
            assistantMessageIdRef.current,
            setIsLoading,
            setCurrentRequestId,
            setMessages,
            toast,
          )
          void refreshCurrentSessionMetadata()
          assistantMessageIdRef.current = null
          currentRequestIdRef.current = null
          setStopRequested(false)
        }),
      ])

      if (disposed) {
        unlistenChunk()
        unlistenThinkingChunk()
        unlistenToolStart()
        unlistenToolEnd()
        unlistenAiStatus()
        unlistenRequestEnd()
        return
      }

      cleanupFns.push(
        unlistenChunk,
        unlistenThinkingChunk,
        unlistenToolStart,
        unlistenToolEnd,
        unlistenAiStatus,
        unlistenRequestEnd,
      )
    }

    void registerListeners()

    return () => {
      disposed = true
      cleanupFns.splice(0).forEach((cleanup) => cleanup())
    }
  }, [toast, refreshCurrentSessionMetadata])

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
      } else if (event.type === 'tool-end') {
        applyToolEnd(currentRequestId, event.tool, event.success, event.result, currentRequestId, setMessages, setPendingEvents)
      } else if (event.type === 'text') {
        appendTextChunk(currentRequestId, event.chunk, currentRequestId, setMessages, setPendingEvents)
      } else {
        applyStatus(currentRequestId, event.text, currentRequestId, setMessages, setPendingEvents)
      }
    })

    setPendingEvents((prev) => {
      const next = { ...prev }
      delete next[currentRequestId]
      return next
    })
  }, [currentRequestId, pendingEvents])

  useEffect(() => {
    if (!currentRequestId) {
      return
    }

    const pendingEnd = pendingRequestEnds[currentRequestId]
    if (!pendingEnd) {
      return
    }

    finalizeStreamingRequest(
      pendingEnd,
      assistantMessageIdRef.current,
      setIsLoading,
      setCurrentRequestId,
      setMessages,
      toast,
    )
    void refreshCurrentSessionMetadata()
    assistantMessageIdRef.current = null
    currentRequestIdRef.current = null
    setStopRequested(false)

    setPendingRequestEnds((prev) => {
      const next = { ...prev }
      delete next[currentRequestId]
      return next
    })
  }, [currentRequestId, pendingRequestEnds, refreshCurrentSessionMetadata, toast])

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
      toast.error('请先点击“立即开始对话”，或从历史会话中选择一个已有会话')
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
      timeline: [],
    }

    assistantMessageIdRef.current = assistantMessage.id

    console.log('[ChatInterface] Sending message:', userMessage.content)
    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setValue('')
    setIsLoading(true)
    setStopRequested(false)

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
    if (!currentRequestIdRef.current || stopRequested) {
      return
    }

    try {
      setStopRequested(true)
      await aiService.cancelMessage()
      toast.info('正在停止当前生成...')
    } catch (error) {
      setStopRequested(false)
      console.error('Failed to cancel message:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`停止生成失败: ${errorMessage}`)
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
    const hydrated = await hydrateSession(sessionId)
    if (!hydrated) {
      return
    }

    try {
      const workingDir = await workspaceService.getCurrentWorkspace()
      if (!workingDir) {
        toast.error('请先选择工作区')
        return
      }

      await aiService.activateSession(sessionId, workingDir)
      toast.success('会话已加载')
    } catch (error) {
      console.error('Failed to activate session runtime:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.warning(`会话历史已加载，但当前无法继续对话: ${errorMessage}`)
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
      await loadSessions(sessionId)
      toast.success('新会话已创建')
    } catch (error) {
      console.error('Failed to create session:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`创建会话失败: ${errorMessage}`)
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = await toast.confirm({
      title: '删除会话',
      message: '确定要删除这个会话吗？该操作不可恢复。',
      confirmText: '删除',
      cancelText: '取消',
      danger: true,
    })
    if (!confirmed) return

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
          <div className="h-full flex items-center justify-center px-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <button
                type="button"
                onClick={handleNewSession}
                className="inline-flex min-h-[44px] items-center justify-center rounded border border-[#1177BB] bg-[#007ACC] px-4 py-2 text-sm font-medium text-white cursor-pointer transition-colors duration-200 hover:bg-[#1485D1] focus:outline-none focus:ring-2 focus:ring-[#007ACC] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)]"
              >
                立即开始对话
              </button>
              <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
                创建会话后即可开始提问。
              </p>
            </div>
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
          placeholder={currentSessionId ? '输入消息...' : '请先点击“立即开始对话”，或打开历史记录选择已有会话'}
          disabled={isLoading || !currentSessionId}
          className="w-full min-h-[84px] resize-none rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)] outline-none focus:border-[#007ACC] disabled:opacity-50"
        />

        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            {isLoading && (
              <button
                onClick={handleCancel}
                disabled={stopRequested}
                className="inline-flex h-7 items-center rounded border border-[#C96B00] bg-[#3A2A12] px-3 text-xs font-medium text-[#F5C17A] transition-colors duration-200 hover:bg-[#4A3416] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stopRequested ? '停止中...' : '停止生成'}
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
