import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AiSettings, ProviderConfig } from '@/types/ai-settings'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export const aiService = {
  async initSession(workingDir: string): Promise<string> {
    return invoke('init_ai_session', { workingDir })
  },

  async sendMessage(message: string): Promise<string> {
    return invoke('send_ai_message', { message })
  },

  async cancelMessage(): Promise<void> {
    return invoke('cancel_ai_message')
  },

  async clearSession(): Promise<void> {
    return invoke('clear_ai_session')
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

  onRequestEnd(callback: (data: { request_id: string; result: string; final_text?: string }) => void) {
    return listen('ai-request-end', (event) => callback(event.payload as any))
  },
}

export type { AiSettings, ProviderConfig }
