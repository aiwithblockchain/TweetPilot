import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssistantMessage } from './AssistantMessage'
import type { ChatMessage } from './types'

function createAssistantMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('AssistantMessage', () => {
  it('renders timeline items in chronological order', () => {
    render(
      <AssistantMessage
        message={createAssistantMessage({
          timeline: [
            {
              id: 'thinking-1',
              type: 'thinking',
              content: 'first thought',
              isActive: false,
              isComplete: true,
            },
            {
              id: 'tool-1',
              type: 'tool',
              toolCall: {
                id: 'tool-call-1',
                tool: 'Read',
                action: 'Read file',
                status: 'success',
                output: 'file body',
                duration: 1.2,
                startTime: 100,
                endTime: 1300,
              },
            },
            {
              id: 'text-1',
              type: 'text',
              content: 'final answer',
            },
          ],
        })}
      />,
    )

    const orderedItems = [
      screen.getByText('first thought'),
      screen.getByText('file body'),
      screen.getByText('final answer'),
    ]

    expect(orderedItems[0].compareDocumentPosition(orderedItems[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(orderedItems[1].compareDocumentPosition(orderedItems[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders thinking completion and tool metadata', () => {
    render(
      <AssistantMessage
        message={createAssistantMessage({
          timeline: [
            {
              id: 'thinking-1',
              type: 'thinking',
              content: 'done thinking',
              isActive: false,
              isComplete: true,
            },
            {
              id: 'tool-1',
              type: 'tool',
              toolCall: {
                id: 'tool-call-1',
                tool: 'Bash',
                action: 'Run command',
                status: 'running',
                startTime: 100,
              },
            },
          ],
        })}
      />,
    )

    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    expect(screen.getByText('done thinking').textContent).toBe('done thinking')
    expect(screen.getByText('Bash').textContent).toBe('Bash')
    expect(screen.getByText('running').textContent).toBe('running')
    expect(screen.getByText('Run command').textContent).toBe('Run command')
  })

  it('shows fallback status only when streaming without timeline items', () => {
    const { rerender } = render(
      <AssistantMessage
        message={createAssistantMessage({
          isStreaming: true,
          status: 'Waiting for response',
          timeline: [],
        })}
      />,
    )

    expect(screen.getByText('Waiting for response').textContent).toBe('Waiting for response')

    rerender(
      <AssistantMessage
        message={createAssistantMessage({
          isStreaming: true,
          status: 'Waiting for response',
          timeline: [
            {
              id: 'text-1',
              type: 'text',
              content: 'partial answer',
            },
          ],
        })}
      />,
    )

    expect(screen.queryByText('Waiting for response')).toBeNull()
    expect(screen.getByText('partial answer').textContent).toBe('partial answer')
  })
})
