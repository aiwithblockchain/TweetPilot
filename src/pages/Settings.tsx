import { useEffect, useState } from 'react'
import AccountManagement from '../components/AccountManagement'
import { settingsService } from '@/services'
import { useToast } from '@/contexts/ToastContext'
import type { AppSettings } from '@/services/settings'

type SettingsSection = 'accounts' | 'preferences'

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('accounts')

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 flex items-center px-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold">设置</h2>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[200px] flex-shrink-0 border-r border-[var(--color-border)] p-3">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveSection('accounts')}
              className={`px-3 py-2 text-sm text-left rounded transition-colors ${
                activeSection === 'accounts'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
              }`}
            >
              Twitter 账号
            </button>
            <button
              onClick={() => setActiveSection('preferences')}
              className={`px-3 py-2 text-sm text-left rounded transition-colors ${
                activeSection === 'preferences'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
              }`}
            >
              系统偏好
            </button>
          </nav>
        </aside>

        <main className="flex-1 overflow-auto p-6">
          {activeSection === 'accounts' && <AccountManagement />}
          {activeSection === 'preferences' && <PreferencesSection />}
        </main>
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
