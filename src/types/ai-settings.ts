export interface ProviderConfig {
  id: string
  name: string
  api_key: string
  base_url?: string
  model: string
  enabled: boolean
}

export interface AiSettings {
  active_provider: string
  providers: ProviderConfig[]
}

export type ProviderType = 'anthropic' | 'openai' | 'openai-compatible' | 'ollama' | 'custom'

export interface ProviderDraft extends ProviderConfig {
  type: ProviderType
}

const BUILT_IN_PROVIDER_TYPES: Record<string, ProviderType> = {
  anthropic: 'anthropic',
  openai: 'openai',
  ollama: 'ollama',
  deepseek: 'openai-compatible',
  groq: 'openai-compatible',
}

export function getProviderType(providerId: string, baseUrl?: string): ProviderType {
  if (BUILT_IN_PROVIDER_TYPES[providerId]) {
    return BUILT_IN_PROVIDER_TYPES[providerId]
  }

  const normalizedBaseUrl = baseUrl?.toLowerCase() ?? ''
  if (normalizedBaseUrl.includes('localhost:11434') || normalizedBaseUrl.includes('127.0.0.1:11434')) {
    return 'ollama'
  }

  return normalizedBaseUrl ? 'openai-compatible' : 'custom'
}

export function isProviderEditableType(providerId: string): boolean {
  return !BUILT_IN_PROVIDER_TYPES[providerId]
}

export function providerRequiresApiKey(type: ProviderType): boolean {
  return type !== 'ollama'
}

export function getDefaultBaseUrlForType(type: ProviderType): string {
  switch (type) {
    case 'anthropic':
      return 'https://api.anthropic.com'
    case 'openai':
      return 'https://api.openai.com'
    case 'ollama':
      return 'http://localhost:11434'
    case 'openai-compatible':
    case 'custom':
    default:
      return ''
  }
}

export function getProviderTypeLabel(type: ProviderType): string {
  switch (type) {
    case 'anthropic':
      return 'Anthropic'
    case 'openai':
      return 'OpenAI'
    case 'openai-compatible':
      return 'OpenAI Compatible'
    case 'ollama':
      return 'Ollama'
    case 'custom':
    default:
      return 'Custom'
  }
}

export function createCustomProviderId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function toProviderDraft(provider: ProviderConfig): ProviderDraft {
  return {
    ...provider,
    type: getProviderType(provider.id, provider.base_url),
  }
}

export function toProviderConfig(draft: ProviderDraft): ProviderConfig {
  const { type, ...config } = draft
  return config
}
