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
  AssistantMessage: ({ message }: { message: { content: string } }) => <div>{message.content}</div>,
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
      expect(screen.getByText('尚未选择会话').textContent).toBe('尚未选择会话')
      expect((screen.getByPlaceholderText('请先选择历史会话，或点击右上角 + 新建会话') as HTMLTextAreaElement).disabled).toBe(true)
    })
  })
})
