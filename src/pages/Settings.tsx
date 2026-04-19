import { useEffect, useState } from 'react'
import { settingsService } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type { AppSettings } from '@/services/settings'

type SettingsSection = 'account' | 'preferences'

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
    <div className="h-full flex flex-col bg-[#1E1E1E] text-[#CCCCCC]">
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-[220px] h-full flex-shrink-0 border-r border-[#2A2A2A] p-3 bg-[#252526] overflow-auto">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveSection('account')}
              className={[
                'px-3 py-2 text-sm text-left rounded transition-colors',
                activeSection === 'account'
                  ? 'bg-[#1E1E1E] text-[#CCCCCC]'
                  : 'text-[#858585] hover:bg-[#2A2A2A] hover:text-[#CCCCCC]',
              ].join(' ')}
            >
              账号设置
            </button>
            <button
              onClick={() => setActiveSection('preferences')}
              className={[
                'px-3 py-2 text-sm text-left rounded transition-colors',
                activeSection === 'preferences'
                  ? 'bg-[#1E1E1E] text-[#CCCCCC]'
                  : 'text-[#858585] hover:bg-[#2A2A2A] hover:text-[#CCCCCC]',
              ].join(' ')}
            >
              系统偏好
            </button>
          </nav>
        </aside>

        <main className="flex-1 min-h-0 overflow-auto p-6 bg-[#1E1E1E]">
          {activeSection === 'account' && <AccountSettingsSection />}
          {activeSection === 'preferences' && <PreferencesSection />}
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

      <div className="rounded-lg border border-[#2A2A2A] bg-[#252526] p-6">
        {!isLoggedIn || !user ? (
          <div className="flex flex-col items-start gap-5">
            <div className="w-14 h-14 rounded-full bg-white text-[#4285F4] flex items-center justify-center text-2xl font-semibold">
              G
            </div>
            <div>
              <div className="text-base font-medium text-[#CCCCCC]">使用 Google 账号登录</div>
              <div className="text-sm text-[#858585] mt-2 leading-6">
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
                <div className="text-sm font-medium text-[#CCCCCC]">{user.email}</div>
                <div className="text-xs text-[#858585] mt-1">订阅等级：{user.tier === 'free' ? 'Free' : 'Pro'}</div>
              </div>
            </div>

            <div className="rounded border border-[#2A2A2A] bg-[#1E1E1E] p-4">
              <div className="flex items-center justify-between text-xs text-[#858585] mb-2">
                <span>Token 使用额度</span>
                <span>{Math.round(usagePercentage)}%</span>
              </div>
              <div className="h-2 rounded bg-[#2A2A2A] overflow-hidden">
                <div className="h-full bg-[#007ACC]" style={{ width: `${usagePercentage}%` }} />
              </div>
              <div className="text-xs text-[#858585] mt-2">
                {user.tokenUsed.toLocaleString()} / {user.tokenLimit.toLocaleString()} tokens
              </div>
            </div>

            <button
              onClick={() => {
                setIsLoggedIn(false)
                setUser(null)
              }}
              className="h-9 px-4 rounded border border-[#2A2A2A] text-sm text-[#CCCCCC] hover:bg-[#2A2A2A] transition-colors"
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
