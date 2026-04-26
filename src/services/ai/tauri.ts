import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AiSettings, ProviderConfig } from '@/types/ai-settings'
import type { PersistedAssistantTimelineItem } from '@/components/ChatInterface/types'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface StoredToolCall {
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

export interface StoredMessage {
  id?: string | null
  role: string
  content: string
  timestamp: number
  thinking?: string | null
  thinking_complete?: boolean | null
  tool_calls?: StoredToolCall[] | null
  timeline?: PersistedAssistantTimelineItem[] | null
  status?: string | null
}

export interface LoadedSession {
  session: SessionMetadata
  messages: StoredMessage[]
}

export interface SessionMetadata {
  id: string
  title: string
  created_at: number
  updated_at: number
  message_count: number
  workspace: string
  schema_version?: number | null
}

export const aiService = {
  async initSession(workingDir: string): Promise<string> {
    return invoke('init_ai_session', { workingDir })
  },

  async sendMessage(message: string, workingDir: string): Promise<{ request_id: string }> {
    console.log('[aiService] Invoking send_ai_message', { messageLength: message.length, workingDir })
    try {
      const response = await invoke<{ request_id: string }>('send_ai_message', { message, workingDir })
      console.log('[aiService] send_ai_message resolved', response)
      return response
    } catch (error) {
      console.error('[aiService] send_ai_message failed', error)
      throw error
    }
  },

  async cancelMessage(): Promise<void> {
    return invoke('cancel_ai_message')
  },

  async clearSession(workingDir: string, sessionId: string): Promise<void> {
    return invoke('clear_ai_session', { workingDir, sessionId })
  },

  async getConfig(): Promise<AiSettings> {
    return invoke('get_ai_config')
  },

  async saveConfig(config: AiSettings): Promise<void> {
    return invoke('save_ai_config', { config })
  },

  onMessageChunk(callback: (data: { request_id: string; chunk: string }) => void) {
    return listen('message-chunk', (event) => callback(event.payload as any))
  },

  onThinkingChunk(callback: (data: { request_id: string; chunk: string }) => void) {
    return listen('thinking-chunk', (event) => callback(event.payload as any))
  },

  onToolCallStart(callback: (data: { request_id: string; tool: string; action: string }) => void) {
    return listen('tool-call-start', (event) => callback(event.payload as any))
  },

  onToolCallEnd(callback: (data: { request_id: string; tool: string; success: boolean; result: string }) => void) {
    return listen('tool-call-end', (event) => callback(event.payload as any))
  },

  onAiStatus(callback: (data: { request_id: string; phase: string; text: string }) => void) {
    return listen('ai-status', (event) => callback(event.payload as any))
  },

  onRequestEnd(callback: (data: { request_id: string; result: string; final_text?: string; error?: string }) => void) {
    return listen('ai-request-end', (event) => callback(event.payload as any))
  },

  async listSessions(workingDir: string): Promise<SessionMetadata[]> {
    return invoke('list_ai_sessions', { workingDir })
  },

  async getSessionMetadata(workingDir: string, sessionId: string): Promise<SessionMetadata> {
    return invoke('get_session_metadata', { workingDir, sessionId })
  },

  async loadSession(workingDir: string, sessionId: string): Promise<LoadedSession> {
    return invoke('load_ai_session', { workingDir, sessionId })
  },

  async activateSession(sessionId: string, workingDir: string): Promise<void> {
    return invoke('activate_ai_session', { sessionId, workingDir })
  },

  async deleteSession(workingDir: string, sessionId: string): Promise<void> {
    return invoke('delete_ai_session', { workingDir, sessionId })
  },

  async createNewSession(workingDir: string): Promise<string> {
    return invoke('create_new_session', { workingDir })
  },
}

export type { AiSettings, ProviderConfig }
