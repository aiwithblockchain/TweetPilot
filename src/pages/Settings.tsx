import { useEffect, useState, useRef } from 'react'
import { settingsService } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type { AppSettings } from '@/services/settings'
import { aiService } from '@/services/ai/tauri'
import type { AiSettings, ProviderConfig } from '@/types/ai-settings'
import {
  toProviderDraft,
  toProviderConfig,
  getProviderTypeLabel,
  isProviderEditableType,
  providerRequiresApiKey,
  getDefaultBaseUrlForType,
  createCustomProviderId,
  type ProviderDraft,
  type ProviderType,
} from '@/types/ai-settings'

type SettingsSection = 'account' | 'preferences' | 'ai-providers'

interface MockUser {
  email: string
  avatar: string
  tier: 'free' | 'pro'
  tokenUsed: number
  tokenLimit: number
}

const MOCK_USER: MockUser = {
  email: 'demo@example.com',
  avatar: 'D',
  tier: 'free',
  tokenUsed: 1000,
  tokenLimit: 10000,
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account')

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-[220px] h-full flex-shrink-0 border-r border-[var(--color-border)] p-3 bg-[var(--color-surface)] overflow-auto">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveSection('account')}
              className={[
                'px-3 py-2 text-sm text-left rounded transition-colors',
                activeSection === 'account'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              账号设置
            </button>
            <button
              onClick={() => setActiveSection('preferences')}
              className={[
                'px-3 py-2 text-sm text-left rounded transition-colors',
                activeSection === 'preferences'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              系统偏好
            </button>
            <button
              onClick={() => setActiveSection('ai-providers')}
              className={[
                'px-3 py-2 text-sm text-left rounded transition-colors',
                activeSection === 'ai-providers'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              AI 配置
            </button>
          </nav>
        </aside>

        <main className="flex-1 min-h-0 overflow-auto p-6 bg-[var(--color-bg)]">
          {activeSection === 'account' && <AccountSettingsSection />}
          {activeSection === 'preferences' && <PreferencesSection />}
          {activeSection === 'ai-providers' && <AiProvidersSection />}
        </main>
      </div>
    </div>
  )
}

function AccountSettingsSection() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<MockUser | null>(null)

  const usagePercentage = user ? Math.min(100, (user.tokenUsed / user.tokenLimit) * 100) : 0

  return (
    <div className="max-w-xl">
      <h3 className="text-base font-semibold mb-4">账号设置</h3>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        {!isLoggedIn || !user ? (
          <div className="flex flex-col items-start gap-5">
            <div className="w-14 h-14 rounded-full bg-white text-[#4285F4] flex items-center justify-center text-2xl font-semibold">
              G
            </div>
            <div>
              <div className="text-base font-medium text-[var(--color-text)]">使用 Google 账号登录</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-2 leading-6">
                登录后可同步您的设置、订阅状态以及未来的 Claude 助手能力。
              </div>
            </div>
            <button
              onClick={() => {
                setIsLoggedIn(true)
                setUser(MOCK_USER)
              }}
              className="h-9 px-4 rounded bg-[#007ACC] text-white text-sm hover:bg-[#1485D1] transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#007ACC] text-white flex items-center justify-center text-base font-semibold">
                {user.avatar}
              </div>
              <div>
                <div className="text-sm font-medium text-[var(--color-text)]">{user.email}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">订阅等级：{user.tier === 'free' ? 'Free' : 'Pro'}</div>
              </div>
            </div>

            <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-2">
                <span>Token 使用额度</span>
                <span>{Math.round(usagePercentage)}%</span>
              </div>
              <div className="h-2 rounded bg-[var(--color-border)] overflow-hidden">
                <div className="h-full bg-[#007ACC]" style={{ width: `${usagePercentage}%` }} />
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-2">
                {user.tokenUsed.toLocaleString()} / {user.tokenLimit.toLocaleString()} tokens
              </div>
            </div>

            <button
              onClick={() => {
                setIsLoggedIn(false)
                setUser(null)
              }}
              className="h-9 px-4 rounded border border-[var(--color-border)] text-sm text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement

  if (theme === 'light') {
    root.classList.remove('dark')
    return
  }

  if (theme === 'dark') {
    root.classList.add('dark')
    return
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (prefersDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function parseEndpoint(endpoint: string): { ip: string; port: string } {
  try {
    const parsed = new URL(endpoint)
    const protocolDefaultPort = parsed.protocol === 'https:' ? '443' : '80'

    return {
      ip: parsed.hostname || '127.0.0.1',
      port: parsed.port || protocolDefaultPort,
    }
  } catch {
    return {
      ip: '127.0.0.1',
      port: '8000',
    }
  }
}

function PreferencesSection() {
  const [language, setLanguage] = useState('zh-CN')
  const [theme, setTheme] = useState<AppSettings['theme']>('dark')
  const [localBridgeIp, setLocalBridgeIp] = useState('127.0.0.1')
  const [localBridgePort, setLocalBridgePort] = useState('10088')
  const [localBridgeTimeoutMs, setLocalBridgeTimeoutMs] = useState(30000)
  const [localBridgeSyncIntervalMs, setLocalBridgeSyncIntervalMs] = useState(60000)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        const [appSettings, localBridgeConfig] = await Promise.all([
          settingsService.getSettings(),
          settingsService.getLocalBridgeConfig(),
        ])

        setLanguage(appSettings.language)
        setTheme(appSettings.theme)
        applyTheme(appSettings.theme)

        const { ip, port } = parseEndpoint(localBridgeConfig.endpoint)
        setLocalBridgeIp(ip)
        setLocalBridgePort(port)
        setLocalBridgeTimeoutMs(localBridgeConfig.timeoutMs)
        setLocalBridgeSyncIntervalMs(localBridgeConfig.syncIntervalMs)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : '读取设置失败')
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
  }, [])

  const handleThemeChange = (newTheme: AppSettings['theme']) => {
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  const handleSave = async () => {
    if (!localBridgeIp.trim()) {
      toast.warning('IP 地址不能为空')
      return
    }

    const port = Number(localBridgePort)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      toast.warning('端口必须是 1-65535 的整数')
      return
    }

    setSaving(true)

    try {
      await settingsService.updateSettings({
        language: language.trim(),
        theme,
      })

      await settingsService.updateLocalBridgeConfig({
        endpoint: `http://${localBridgeIp.trim()}:${port}`,
        timeoutMs: localBridgeTimeoutMs,
        syncIntervalMs: localBridgeSyncIntervalMs,
      })

      toast.success('设置已保存')
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('保存失败: ' + (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-secondary">读取设置中...</div>
  }

  return (
    <div>
      <h3 className="text-base font-semibold mb-4">系统偏好</h3>

      {loadError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-sm text-red-500">
          {loadError}
        </div>
      )}

      <div className="max-w-md space-y-6">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">语言</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
            >
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">主题</label>
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value as AppSettings['theme'])}
              className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
            >
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="system">跟随系统</option>
            </select>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <div className="text-sm font-semibold mb-3">LocalBridge 设置</div>

          <div>
            <label className="block text-sm font-medium mb-1.5">IP 地址</label>
            <input
              type="text"
              value={localBridgeIp}
              onChange={(e) => setLocalBridgeIp(e.target.value)}
              placeholder="127.0.0.1"
              className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">端口</label>
            <input
              type="text"
              value={localBridgePort}
              onChange={(e) => setLocalBridgePort(e.target.value)}
              placeholder="10088"
              className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  )
}

const CUSTOM_PROVIDER_TYPE_OPTIONS: ProviderType[] = [
  'anthropic',
  'openai',
  'openai-compatible',
  'ollama',
  'custom',
]

function AiProvidersSection() {
  const toast = useToast()
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [editingProvider, setEditingProvider] = useState<ProviderDraft | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const autosaveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const config = await aiService.getConfig()
      setSettings(config)
    } catch (error) {
      console.error('Failed to load AI settings:', error)
      toast.error('加载 AI 配置失败')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (newSettings: AiSettings) => {
    setSaving(true)
    try {
      await aiService.saveConfig(newSettings)
      setSettings(newSettings)
      toast.success('配置已保存')
    } catch (error) {
      console.error('Failed to save AI settings:', error)
      toast.error('保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  const scheduleAutosave = (newSettings: AiSettings) => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      void saveSettings(newSettings)
      autosaveTimerRef.current = null
    }, 700)
  }

  const handleAddProvider = () => {
    const newProvider: ProviderDraft = {
      id: createCustomProviderId(),
      name: '',
      api_key: '',
      base_url: getDefaultBaseUrlForType('anthropic'),
      model: '',
      enabled: true,
      type: 'anthropic',
    }
    setEditingProvider(newProvider)
  }

  const handleEditProvider = (provider: ProviderConfig) => {
    setEditingProvider(toProviderDraft(provider))
  }

  const handleSaveProvider = async () => {
    if (!editingProvider || !settings) return

    const isValid = editingProvider.name.trim() &&
                    editingProvider.model.trim() &&
                    (editingProvider.type === 'ollama' || editingProvider.api_key.trim())

    if (!isValid) {
      toast.warning('请填写所有必填字段')
      return
    }

    const providerConfig = toProviderConfig(editingProvider)
    const existingIndex = settings.providers.findIndex(p => p.id === providerConfig.id)
    const newProviders = [...settings.providers]

    if (existingIndex >= 0) {
      newProviders[existingIndex] = providerConfig
    } else {
      newProviders.push(providerConfig)
    }

    const newSettings: AiSettings = {
      ...settings,
      providers: newProviders,
    }

    await saveSettings(newSettings)
    setEditingProvider(null)
  }

  const handleDeleteProvider = async (providerId: string) => {
    if (!settings) return

    const newProviders = settings.providers.filter(p => p.id !== providerId)
    if (newProviders.length === 0) {
      toast.warning('至少需要保留一个 Provider')
      return
    }

    const newSettings: AiSettings = {
      ...settings,
      providers: newProviders,
      active_provider: settings.active_provider === providerId
        ? newProviders[0].id
        : settings.active_provider,
    }

    await saveSettings(newSettings)
    if (editingProvider?.id === providerId) {
      setEditingProvider(null)
    }
  }

  const handleSetActive = async (providerId: string) => {
    if (!settings || settings.active_provider === providerId) return

    const newSettings: AiSettings = {
      ...settings,
      active_provider: providerId,
    }

    await saveSettings(newSettings)
  }

  const updateEditingProvider = (updater: (current: ProviderDraft) => ProviderDraft) => {
    setEditingProvider(current => {
      if (!current) return current
      const updated = updater(current)

      if (settings && updated.name.trim() && updated.model.trim() &&
          (updated.type === 'ollama' || updated.api_key.trim())) {
        const providerConfig = toProviderConfig(updated)
        const existingIndex = settings.providers.findIndex(p => p.id === providerConfig.id)
        const newProviders = [...settings.providers]

        if (existingIndex >= 0) {
          newProviders[existingIndex] = providerConfig
        } else {
          newProviders.push(providerConfig)
        }

        scheduleAutosave({
          ...settings,
          providers: newProviders,
        })
      }

      return updated
    })
  }

  const updateEditingType = (type: ProviderType) => {
    if (!editingProvider) return

    updateEditingProvider(current => ({
      ...current,
      type,
      base_url: getDefaultBaseUrlForType(type),
      api_key: type === 'ollama' ? '' : current.api_key,
    }))
  }

  if (loading) {
    return <div className="text-sm text-[var(--color-text-secondary)]">加载中...</div>
  }

  if (!settings) {
    return <div className="text-sm text-[var(--color-text-secondary)]">加载配置失败</div>
  }

  const apiKeyRequired = editingProvider ? providerRequiresApiKey(editingProvider.type) : true
  const editingTypeLocked = editingProvider ? !isProviderEditableType(editingProvider.id) : false

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">AI Providers</h3>
        {!editingProvider && (
          <button
            onClick={handleAddProvider}
            className="h-8 px-3 text-sm bg-[#007ACC] text-white rounded hover:bg-[#1485D1] transition-colors"
          >
            添加 Provider
          </button>
        )}
      </div>

      {!editingProvider ? (
        <div className="space-y-3">
          {settings.providers.map(provider => {
            const draft = toProviderDraft(provider)
            return (
              <div
                key={provider.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">{provider.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
                        {getProviderTypeLabel(draft.type)}
                      </span>
                      {isProviderEditableType(provider.id) ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                          Custom
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-500">
                          Built-in
                        </span>
                      )}
                      {settings.active_provider === provider.id && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[#007ACC] text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      Model: {provider.model}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {provider.base_url || 'Default endpoint'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {settings.active_provider !== provider.id && (
                      <button
                        onClick={() => handleSetActive(provider.id)}
                        className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors"
                      >
                        设为激活
                      </button>
                    )}
                    <button
                      onClick={() => handleEditProvider(provider)}
                      className="text-xs px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteProvider(provider.id)}
                      className="text-xs px-2 py-1 rounded border border-red-500 text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setEditingProvider(null)}
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              ← 返回列表
            </button>
            {saving && <span className="text-xs text-[var(--color-text-secondary)]">保存中...</span>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Provider 名称 *</label>
            <input
              type="text"
              value={editingProvider.name}
              onChange={e => updateEditingProvider(current => ({ ...current, name: e.target.value }))}
              placeholder="例如: My Anthropic"
              className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">类型 *</label>
            <select
              value={editingProvider.type}
              onChange={e => updateEditingType(e.target.value as ProviderType)}
              disabled={editingTypeLocked}
              className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded disabled:opacity-50"
            >
              {editingTypeLocked ? (
                <option value={editingProvider.type}>{getProviderTypeLabel(editingProvider.type)}</option>
              ) : (
                CUSTOM_PROVIDER_TYPE_OPTIONS.map(type => (
                  <option key={type} value={type}>{getProviderTypeLabel(type)}</option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">
              {apiKeyRequired ? 'API Key *' : 'API Key (可选)'}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={editingProvider.api_key}
                onChange={e => updateEditingProvider(current => ({ ...current, api_key: e.target.value }))}
                placeholder={apiKeyRequired ? '输入 API Key' : '此 Provider 类型可选'}
                disabled={editingProvider.type === 'ollama'}
                className="w-full h-8 px-3 pr-10 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded disabled:opacity-50"
              />
              {editingProvider.type !== 'ollama' && (
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm"
                >
                  {showApiKey ? '👁️' : '👁️‍🗨️'}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Base URL *</label>
            <input
              type="text"
              value={editingProvider.base_url || ''}
              onChange={e => updateEditingProvider(current => ({ ...current, base_url: e.target.value }))}
              placeholder={editingProvider.type === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com'}
              className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Model *</label>
            <input
              type="text"
              value={editingProvider.model}
              onChange={e => updateEditingProvider(current => ({ ...current, model: e.target.value }))}
              placeholder="例如: claude-sonnet-4-6"
              className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setEditingProvider(null)}
              className="h-8 px-3 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveProvider}
              disabled={saving}
              className="h-8 px-3 text-sm bg-[#007ACC] text-white rounded hover:bg-[#1485D1] transition-colors disabled:opacity-50"
            >
              保存 Provider
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
