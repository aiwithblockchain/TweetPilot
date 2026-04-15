import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import WorkspaceSelector from './pages/WorkspaceSelector'

function App() {
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
      <header className="h-12 bg-[var(--color-surface)] border-b flex items-center px-4">
        <div className="text-sm text-secondary">
          Workspace: {currentWorkspace}
        </div>
      </header>
      <main className="flex-1 p-4">
        <h1 className="text-2xl font-bold">TweetPilot</h1>
        <p className="mt-2 text-secondary">Welcome to TweetPilot!</p>
      </main>
    </div>
  )
}

export default App
