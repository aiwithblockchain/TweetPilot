import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const scrollIntoViewMock = vi.fn()
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: scrollIntoViewMock,
})

const workspaceChangedListeners: Array<() => void> = []

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, callback: () => void) => {
    if (eventName === 'workspace-changed') {
      workspaceChangedListeners.push(callback)
    }
    return () => {}
  }),
}))

import { ChatInterface } from './ChatInterface'

const { toast, mockAiService, mockWorkspaceService } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  mockAiService: {
    getConfig: vi.fn(),
    listSessions: vi.fn(),
    loadSession: vi.fn(),
    activateSession: vi.fn(),
    createNewSession: vi.fn(),
    deleteSession: vi.fn(),
    sendMessage: vi.fn(),
    cancelMessage: vi.fn(),
    clearSession: vi.fn(),
    getSessionMetadata: vi.fn(),
    onMessageChunk: vi.fn(),
    onThinkingChunk: vi.fn(),
    onToolCallStart: vi.fn(),
    onToolCallEnd: vi.fn(),
    onAiStatus: vi.fn(),
    onRequestEnd: vi.fn(),
  },
  mockWorkspaceService: {
    getCurrentWorkspace: vi.fn(),
  },
}))

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => toast,
}))

vi.mock('@/services/workspace', () => ({
  workspaceService: mockWorkspaceService,
}))

vi.mock('@/services/ai/tauri', () => ({
  aiService: mockAiService,
}))

vi.mock('./ChatInterface/AssistantMessage', () => ({
  AssistantMessage: ({ message }: { message: { content: string; timeline?: Array<{ type: string; content?: string; toolCall?: { tool: string; output?: string } }> } }) => (
    <div>
      {message.timeline?.map((item, index) => {
        if (item.type === 'thinking') {
          return <div key={`thinking-${index}`}>thinking:{item.content}</div>
        }
        if (item.type === 'tool') {
          return <div key={`tool-${index}`}>tool:{item.toolCall?.tool}:{item.toolCall?.output ?? ''}</div>
        }
        return <div key={`text-${index}`}>text:{item.content}</div>
      })}
      <div>{message.content}</div>
    </div>
  ),
}))

vi.mock('./ChatInterface/SessionPanel', () => ({
  SessionPanel: ({ sessions, onSelectSession }: { sessions: Array<{ id: string; title: string }>; onSelectSession: (sessionId: string) => void }) => (
    <div>
      {sessions.map((session) => (
        <button key={session.id} type="button" onClick={() => onSelectSession(session.id)}>
          {session.title}
        </button>
      ))}
    </div>
  ),
}))

describe('ChatInterface', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    workspaceChangedListeners.length = 0
    mockAiService.getConfig.mockResolvedValue({
      providers: [
        { id: 'provider-1', name: 'Test Provider', api_key: 'key', model: 'claude-sonnet-4-6' },
      ],
      active_provider: 'provider-1',
    })
    mockAiService.listSessions.mockResolvedValue([
      {
        id: 'session-1',
        title: 'Test Session',
        created_at: Date.now(),
        updated_at: Date.now(),
        message_count: 0,
        workspace: '/tmp/workspace',
      },
    ])
    mockAiService.loadSession.mockResolvedValue({
      session: {
        id: 'session-1',
        title: 'Test Session',
        created_at: Date.now(),
        updated_at: Date.now(),
        message_count: 2,
        workspace: '/tmp/workspace',
      },
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'restored user',
          timestamp: Date.now() - 1000,
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'restored assistant',
          timestamp: Date.now(),
        },
      ],
    })
    mockAiService.onMessageChunk.mockResolvedValue(() => {})
    mockAiService.onThinkingChunk.mockResolvedValue(() => {})
    mockAiService.onToolCallStart.mockResolvedValue(() => {})
    mockAiService.onToolCallEnd.mockResolvedValue(() => {})
    mockAiService.onAiStatus.mockResolvedValue(() => {})
    mockAiService.onRequestEnd.mockResolvedValue(() => {})
    mockAiService.activateSession.mockResolvedValue(undefined)
    mockAiService.sendMessage.mockResolvedValue({ request_id: 'request-1' })
    mockAiService.createNewSession.mockResolvedValue('session-1')
    mockWorkspaceService.getCurrentWorkspace.mockResolvedValue('/tmp/workspace')
  })

  async function renderReadyChat() {
    render(<ChatInterface />)

    const newSessionButton = await screen.findByTitle('新建会话')
    fireEvent.click(newSessionButton)

    return screen.findByPlaceholderText('输入消息...')
  }

  async function openHistoryAndSelectSession(title: string) {
    render(<ChatInterface />)

    const historyButton = await screen.findByTitle('会话历史')
    fireEvent.click(historyButton)

    const sessionButton = await screen.findByText(title)
    fireEvent.click(sessionButton)

    return screen.findByPlaceholderText('输入消息...')
  }

  it('does not send on Enter while IME composition is active', async () => {
    const input = await renderReadyChat()
    fireEvent.change(input, { target: { value: 'hello' } })

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(event, 'isComposing', { value: true })
    input.dispatchEvent(event)

    expect(mockAiService.sendMessage).not.toHaveBeenCalled()
  })

  it('does not send on Enter while composition ref is active even if keydown is not marked composing', async () => {
    const input = await renderReadyChat()
    fireEvent.change(input, { target: { value: 'hello' } })

    fireEvent.compositionStart(input)
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, which: 13 })

    expect(mockAiService.sendMessage).not.toHaveBeenCalled()
  })

  it('does not send on Enter when browser reports keyCode 229', async () => {
    const input = await renderReadyChat()
    fireEvent.change(input, { target: { value: 'hello' } })

    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229, which: 229 })

    expect(mockAiService.sendMessage).not.toHaveBeenCalled()
  })

  it('does not send on Enter immediately after composition ends', async () => {
    const input = await renderReadyChat()
    fireEvent.change(input, { target: { value: 'hello' } })

    fireEvent.compositionStart(input)
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, which: 13 })

    expect(mockAiService.sendMessage).not.toHaveBeenCalled()
  })

  it('sends on Enter when IME composition is not active', async () => {
    const input = await renderReadyChat()
    fireEvent.change(input, { target: { value: 'hello' } })

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(event, 'isComposing', { value: false })
    input.dispatchEvent(event)

    await waitFor(() => {
      expect(mockAiService.sendMessage).toHaveBeenCalledWith('hello', '/tmp/workspace')
    })
  })

  it('loads restored session history and continues sending in the current workspace', async () => {
    const input = await openHistoryAndSelectSession('Test Session')

    await waitFor(() => {
      expect(mockAiService.loadSession).toHaveBeenCalledWith('/tmp/workspace', 'session-1')
      expect(mockAiService.activateSession).toHaveBeenCalledWith('session-1', '/tmp/workspace')
      expect(screen.getByText('restored user').textContent).toBe('restored user')
      expect(screen.getByText('restored assistant').textContent).toBe('restored assistant')
    })

    fireEvent.change(input, { target: { value: 'continue chat' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, which: 13 })

    await waitFor(() => {
      expect(mockAiService.sendMessage).toHaveBeenCalledWith('continue chat', '/tmp/workspace')
    })
  })

  it('keeps restored history visible when runtime activation fails for a missing provider', async () => {
    mockAiService.activateSession.mockRejectedValueOnce(new Error("Configured provider 'provider-1' for this session no longer exists"))

    await openHistoryAndSelectSession('Test Session')

    await waitFor(() => {
      expect(mockAiService.loadSession).toHaveBeenCalledWith('/tmp/workspace', 'session-1')
      expect(screen.getByText('restored user').textContent).toBe('restored user')
      expect(screen.getByText('restored assistant').textContent).toBe('restored assistant')
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('会话历史已加载，但当前无法继续对话'))
      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("Configured provider 'provider-1' for this session no longer exists"))
    })
  })

  it('refreshes the workspace session list when the selected session no longer exists there', async () => {
    mockAiService.loadSession.mockRejectedValueOnce(new Error('Failed to load AI session metadata: Query returned no rows'))
    mockAiService.listSessions
      .mockResolvedValueOnce([
        {
          id: 'session-1',
          title: 'Test Session',
          created_at: Date.now(),
          updated_at: Date.now(),
          message_count: 0,
          workspace: '/tmp/workspace',
        },
      ])
      .mockResolvedValueOnce([])

    render(<ChatInterface />)

    const historyButton = await screen.findByTitle('会话历史')
    fireEvent.click(historyButton)

    const sessionButton = await screen.findByText('Test Session')
    fireEvent.click(sessionButton)

    await waitFor(() => {
      expect(mockAiService.listSessions).toHaveBeenLastCalledWith('/tmp/workspace')
      expect(toast.error).toHaveBeenCalledWith('当前工作区中找不到该会话，已刷新会话列表')
      expect(screen.getByText('立即开始对话').textContent).toBe('立即开始对话')
      expect((screen.getByPlaceholderText('请先点击“立即开始对话”，或打开历史记录选择已有会话') as HTMLTextAreaElement).disabled).toBe(true)
    })
  })

  it('shows a load error when session history itself cannot be read', async () => {
    mockAiService.loadSession.mockRejectedValueOnce(new Error('session missing'))

    render(<ChatInterface />)

    const historyButton = await screen.findByTitle('会话历史')
    fireEvent.click(historyButton)

    const sessionButton = await screen.findByText('Test Session')
    fireEvent.click(sessionButton)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('加载会话失败: session missing')
    })
  })

  it('replays restored assistant timeline items in persisted chronological order', async () => {
    mockAiService.loadSession.mockResolvedValueOnce({
      session: {
        id: 'session-1',
        title: 'Test Session',
        created_at: Date.now(),
        updated_at: Date.now(),
        message_count: 2,
        workspace: '/tmp/workspace',
      },
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: 'restored user',
          timestamp: Date.now() - 1000,
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'final answer',
          timestamp: Date.now(),
          tool_calls: [
            {
              id: 'tool-1',
              tool: 'Read',
              action: 'Read file',
              output: 'file body',
              status: 'success',
              start_time: Date.now() - 500,
              end_time: Date.now() - 400,
            },
          ],
          timeline: [
            { id: 't-1', type: 'thinking', content: 'first thought', sequence: 0, is_complete: true },
            { id: 't-2', type: 'tool', tool_call_id: 'tool-1', sequence: 1 },
            { id: 't-3', type: 'thinking', content: 'second thought', sequence: 2, is_complete: true },
            { id: 't-4', type: 'text', content: 'final answer', sequence: 3 },
          ],
        },
      ],
    })

    await openHistoryAndSelectSession('Test Session')

    await waitFor(() => {
      const orderedItems = [
        screen.getByText('thinking:first thought'),
        screen.getByText('tool:Read:file body'),
        screen.getByText('thinking:second thought'),
        screen.getByText('text:final answer'),
      ]

      expect(orderedItems[0].compareDocumentPosition(orderedItems[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(orderedItems[1].compareDocumentPosition(orderedItems[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(orderedItems[2].compareDocumentPosition(orderedItems[3]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  it('renders assistant timeline events in the order they arrive', async () => {
    let onThinkingChunk: ((data: { request_id: string; chunk: string }) => void) | undefined
    let onToolCallStart: ((data: { request_id: string; tool: string; action: string }) => void) | undefined
    let onToolCallEnd: ((data: { request_id: string; tool: string; success: boolean; result: string }) => void) | undefined
    let onMessageChunk: ((data: { request_id: string; chunk: string }) => void) | undefined
    let onRequestEnd: ((data: { request_id: string; result: string }) => void) | undefined

    mockAiService.onThinkingChunk.mockImplementation(async (callback: typeof onThinkingChunk) => {
      onThinkingChunk = callback
      return () => {}
    })
    mockAiService.onToolCallStart.mockImplementation(async (callback: typeof onToolCallStart) => {
      onToolCallStart = callback
      return () => {}
    })
    mockAiService.onToolCallEnd.mockImplementation(async (callback: typeof onToolCallEnd) => {
      onToolCallEnd = callback
      return () => {}
    })
    mockAiService.onMessageChunk.mockImplementation(async (callback: typeof onMessageChunk) => {
      onMessageChunk = callback
      return () => {}
    })
    mockAiService.onRequestEnd.mockImplementation(async (callback: typeof onRequestEnd) => {
      onRequestEnd = callback
      return () => {}
    })

    const input = await renderReadyChat()
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, which: 13 })

    await waitFor(() => {
      expect(mockAiService.sendMessage).toHaveBeenCalledWith('hello', '/tmp/workspace')
    })

    onThinkingChunk?.({ request_id: 'request-1', chunk: 'first thought' })
    onToolCallStart?.({ request_id: 'request-1', tool: 'Read', action: 'Read file' })
    onToolCallEnd?.({ request_id: 'request-1', tool: 'Read', success: true, result: 'file body' })
    onThinkingChunk?.({ request_id: 'request-1', chunk: 'second thought' })
    onMessageChunk?.({ request_id: 'request-1', chunk: 'final answer' })
    onRequestEnd?.({ request_id: 'request-1', result: 'success' })

    await waitFor(() => {
      const orderedItems = [
        screen.getByText('thinking:first thought'),
        screen.getByText('tool:Read:file body'),
        screen.getByText('thinking:second thought'),
        screen.getByText('text:final answer'),
      ]

      expect(orderedItems[0].compareDocumentPosition(orderedItems[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(orderedItems[1].compareDocumentPosition(orderedItems[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(orderedItems[2].compareDocumentPosition(orderedItems[3]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  it('clears active session state and reloads sessions when workspace changes', async () => {
    const input = await renderReadyChat()
    fireEvent.change(input, { target: { value: 'hello' } })

    const activeInput = screen.getByPlaceholderText('输入消息...') as HTMLTextAreaElement
    expect(activeInput.placeholder).toBe('输入消息...')

    mockWorkspaceService.getCurrentWorkspace.mockResolvedValue('/tmp/workspace-b')
    mockAiService.listSessions.mockResolvedValueOnce([])

    await waitFor(() => {
      expect(workspaceChangedListeners.length).toBeGreaterThan(0)
    })

    workspaceChangedListeners[workspaceChangedListeners.length - 1]()

    await waitFor(() => {
      expect(mockAiService.listSessions).toHaveBeenLastCalledWith('/tmp/workspace-b')
      expect(screen.getByText('立即开始对话').textContent).toBe('立即开始对话')
      expect((screen.getByPlaceholderText('请先点击“立即开始对话”，或打开历史记录选择已有会话') as HTMLTextAreaElement).disabled).toBe(true)
    })
  })
})
