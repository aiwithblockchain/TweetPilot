export interface ToolCall {
  id: string
  tool: string
  action: string
  input?: string
  output?: string
  status: 'running' | 'success' | 'error'
  duration?: number
  startTime: number
  endTime?: number
}

export interface ThinkingTimelineItem {
  id: string
  type: 'thinking'
  content: string
  isActive?: boolean
  isComplete?: boolean
}

export interface ToolTimelineItem {
  id: string
  type: 'tool'
  toolCall: ToolCall
}

export interface TextTimelineItem {
  id: string
  type: 'text'
  content: string
}

export type AssistantTimelineItem = ThinkingTimelineItem | ToolTimelineItem | TextTimelineItem

export interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  timestamp: number
  isStreaming?: boolean
  thinking?: string
  thinkingComplete?: boolean
  toolCalls?: ToolCall[]
  status?: string
  timeline?: AssistantTimelineItem[]
}

export interface PersistedToolCall {
  id: string
  tool: string
  action: string
  input?: string | null
  output?: string | null
  status: string
  duration?: number | null
  start_time: number
  end_time?: number | null
}
