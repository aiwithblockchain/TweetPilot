import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import WorkspaceSelector from './pages/WorkspaceSelector'
import TaskManagement from './pages/TaskManagement'
import DataBlocks from './pages/DataBlocks'
import Settings from './pages/Settings'

type Page = 'task-management' | 'data-blocks' | 'settings'

function App() {
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>('task-management')
  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false)

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

    // Close dropdown when clicking outside
    const handleClickOutside = () => {
      setShowWorkspaceDropdown(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
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
          <img src="/logo.png" alt="TweetPilot" className="w-6 h-6" />
          <h1 className="text-base font-semibold">TweetPilot</h1>
        </div>
        <div className="flex-1 flex justify-center">
          <div className="text-xs text-secondary">{currentWorkspace}</div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowWorkspaceDropdown(!showWorkspaceDropdown)
              }}
              className="h-7 px-2 text-xs bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors"
            >
              打开工作目录
            </button>

            {showWorkspaceDropdown && (
              <div
                className="absolute top-full right-0 mt-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded shadow-lg min-w-[160px] z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setShowWorkspaceDropdown(false)
                    setCurrentWorkspace(null)
                  }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--color-surface)] transition-colors"
                >
                  在当前窗口打开
                </button>
                <button
                  onClick={async () => {
                    setShowWorkspaceDropdown(false)
                    try {
                      // Just open a new window, don't change current workspace
                      await invoke('open_workspace_in_new_window')
                    } catch (error) {
                      console.error('Failed to open new window:', error)
                      alert('打开新窗口失败: ' + (error as Error).message)
                    }
                  }}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--color-surface)] transition-colors border-t border-[var(--color-border)]"
                >
                  在新窗口打开
                </button>
              </div>
            )}
          </div>
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
          {currentPage === 'data-blocks' && <DataBlocks />}
          {currentPage === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  )
}

export default App
