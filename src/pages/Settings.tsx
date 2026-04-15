import { useState } from 'react'
import AccountManagement from '../components/AccountManagement'

type SettingsSection = 'accounts' | 'preferences'

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('accounts')

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 flex items-center px-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold">设置</h2>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
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

        {/* Right Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {activeSection === 'accounts' && <AccountManagement />}
          {activeSection === 'preferences' && <PreferencesSection />}
        </main>
      </div>
    </div>
  )
}

function PreferencesSection() {
  const [language, setLanguage] = useState('zh-CN')
  const [theme, setTheme] = useState('dark')
  const [startup, setStartup] = useState('last-workspace')

  const handleSave = () => {
    // TODO: Save preferences
    console.log('Saving preferences:', { language, theme, startup })
  }

  return (
    <div>
      <h3 className="text-base font-semibold mb-4">系统偏好</h3>

      <div className="max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 space-y-4">
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
            onChange={(e) => setTheme(e.target.value)}
            className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
          >
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">启动时行为</label>
          <select
            value={startup}
            onChange={(e) => setStartup(e.target.value)}
            className="w-full h-8 px-3 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded"
          >
            <option value="last-workspace">打开上次工作目录</option>
            <option value="show-selector">显示选择界面</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
        >
          保存设置
        </button>
      </div>
    </div>
  )
}
