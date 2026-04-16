import { useEffect, useState } from 'react'
import { workspaceService } from '@/services'

interface WorkspaceSelectorProps {
  currentWorkspace: string | null
  onWorkspaceSelected: (path: string) => void
}

export default function WorkspaceSelector({
  currentWorkspace,
  onWorkspaceSelected,
}: WorkspaceSelectorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentWorkspace) {
      onWorkspaceSelected(currentWorkspace)
    }
  }, [currentWorkspace, onWorkspaceSelected])

  const handleSelectDirectory = async () => {
    setLoading(true)
    setError(null)

    try {
      const path = await workspaceService.selectLocalDirectory()

      if (!path) {
        return
      }

      await workspaceService.setCurrentWorkspace(path)
      onWorkspaceSelected(path)
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
          <h1 className="text-2xl font-semibold mb-3">TweetPilot</h1>
          <p className="text-base text-secondary">
            选择一个工作目录开始使用
          </p>
        </div>

        <div className="grid gap-4">
          <button
            onClick={handleSelectDirectory}
            disabled={loading}
            className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[#6D5BF6] transition-colors text-left disabled:opacity-50"
          >
            <div className="text-base font-medium mb-1">📁 选择本地目录</div>
            <div className="text-xs text-secondary">
              选择一个现有的目录作为工作目录
            </div>
          </button>

          <button
            disabled
            className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg opacity-50 text-left cursor-not-allowed"
          >
            <div className="text-base font-medium mb-1">🔗 从 GitHub 克隆</div>
            <div className="text-xs text-secondary">
              克隆一个 GitHub 仓库作为工作目录（即将推出）
            </div>
          </button>

          <button
            disabled
            className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg opacity-50 text-left cursor-not-allowed"
          >
            <div className="text-base font-medium mb-1">🕐 最近使用</div>
            <div className="text-xs text-secondary">
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
