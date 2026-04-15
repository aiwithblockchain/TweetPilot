import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface WorkspaceSelectorProps {
  onWorkspaceSelected: (path: string) => void
}

export default function WorkspaceSelector({ onWorkspaceSelected }: WorkspaceSelectorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectDirectory = async () => {
    setLoading(true)
    setError(null)

    try {
      const path = await invoke<string | null>('select_local_directory')

      if (path) {
        await invoke('set_current_workspace', { path })
        onWorkspaceSelected(path)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select directory')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="max-w-2xl w-full px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">TweetPilot</h1>
          <p className="text-lg text-secondary">
            选择一个工作目录开始使用
          </p>
        </div>

        <div className="grid gap-4">
          <button
            onClick={handleSelectDirectory}
            disabled={loading}
            className="p-6 bg-[var(--color-surface)] border rounded-lg hover:border-brand-primary transition-colors text-left disabled:opacity-50"
          >
            <div className="text-lg font-semibold mb-2">📁 选择本地目录</div>
            <div className="text-sm text-secondary">
              选择一个现有的目录作为工作目录
            </div>
          </button>

          <button
            disabled
            className="p-6 bg-[var(--color-surface)] border rounded-lg opacity-50 text-left cursor-not-allowed"
          >
            <div className="text-lg font-semibold mb-2">🔗 从 GitHub 克隆</div>
            <div className="text-sm text-secondary">
              克隆一个 GitHub 仓库作为工作目录（即将推出）
            </div>
          </button>

          <button
            disabled
            className="p-6 bg-[var(--color-surface)] border rounded-lg opacity-50 text-left cursor-not-allowed"
          >
            <div className="text-lg font-semibold mb-2">🕐 最近使用</div>
            <div className="text-sm text-secondary">
              从最近使用的工作目录中选择（即将推出）
            </div>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-4 text-center text-secondary">
            正在选择目录...
          </div>
        )}
      </div>
    </div>
  )
}
