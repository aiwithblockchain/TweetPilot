import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import WorkspaceSelector from './pages/WorkspaceSelector'
import TaskManagement from './pages/TaskManagement'
import Settings from './pages/Settings'

type Page = 'task-management' | 'data-blocks' | 'settings'

function App() {
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>('task-management')

  useEffect(() => {
    // 设置默认 Dark 主题
    document.documentElement.classList.add('dark')

    // 检查是否已有工作目录
    invoke<string | null>('get_current_workspace')
      .then((workspace) => {
        setCurrentWorkspace(workspace)
      })
      .catch((error) => {
        console.error('Failed to get current workspace:', error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!currentWorkspace) {
    return <WorkspaceSelector onWorkspaceSelected={setCurrentWorkspace} />
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-12 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center px-4">
        <div className="flex items-center gap-3">
          <div className="text-lg">🐦</div>
          <h1 className="text-base font-semibold">TweetPilot</h1>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="text-xs text-secondary">{currentWorkspace}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentWorkspace(null)}
            className="h-7 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors"
          >
            打开工作目录
          </button>
          <button
            onClick={() => setCurrentPage('settings')}
            className="h-7 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors"
          >
            设置
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[200px] flex-shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] p-3">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setCurrentPage('task-management')}
              className={`flex items-center gap-2 px-3 py-2 text-sm text-left rounded transition-colors ${
                currentPage === 'task-management'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'
              }`}
            >
              <span>📋</span>
              <span>任务管理</span>
            </button>
            <button
              onClick={() => setCurrentPage('data-blocks')}
              className={`flex items-center gap-2 px-3 py-2 text-sm text-left rounded transition-colors ${
                currentPage === 'data-blocks'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'
              }`}
            >
              <span>📊</span>
              <span>数据积木</span>
            </button>
            <button
              onClick={() => setCurrentPage('settings')}
              className={`flex items-center gap-2 px-3 py-2 text-sm text-left rounded transition-colors ${
                currentPage === 'settings'
                  ? 'bg-[var(--color-bg)] text-[var(--color-text)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'
              }`}
            >
              <span>⚙️</span>
              <span>设置</span>
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          {currentPage === 'task-management' && <TaskManagement />}
          {currentPage === 'data-blocks' && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-3">📊</div>
                <div className="text-base font-medium mb-1">数据积木</div>
                <div className="text-xs text-secondary">即将推出</div>
              </div>
            </div>
          )}
          {currentPage === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}

export default App
