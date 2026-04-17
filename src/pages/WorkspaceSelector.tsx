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
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [cloning, setCloning] = useState(false)
  const [targetDirectory, setTargetDirectory] = useState<string | null>(null)

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

  const handleSelectTargetDirectory = async () => {
    try {
      const dir = await workspaceService.selectLocalDirectory()
      if (dir) {
        setTargetDirectory(dir)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '选择目录失败')
    }
  }

  const handleCloneFromGithub = async () => {
    if (!repoUrl.trim()) {
      setError('请输入 GitHub 仓库地址')
      return
    }

    if (!targetDirectory) {
      setError('请先选择下载目录')
      return
    }

    setCloning(true)
    setError(null)

    try {
      const path = await workspaceService.cloneFromGithub(repoUrl.trim(), targetDirectory)
      await workspaceService.setCurrentWorkspace(path)
      setShowCloneDialog(false)
      setRepoUrl('')
      setTargetDirectory(null)
      onWorkspaceSelected(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : '克隆失败')
    } finally {
      setCloning(false)
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
            onClick={() => setShowCloneDialog(true)}
            disabled={loading || cloning}
            className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[#6D5BF6] transition-colors text-left disabled:opacity-50"
          >
            <div className="text-base font-medium mb-1">🔗 从 GitHub 克隆</div>
            <div className="text-xs text-secondary">
              克隆一个 GitHub 仓库作为工作目录
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

        {cloning && (
          <div className="mt-4 text-center text-secondary">
            正在克隆仓库，请稍候...
          </div>
        )}
      </div>

      {showCloneDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">从 GitHub 克隆仓库</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                仓库地址
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo.git"
                className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-sm"
                disabled={cloning}
              />
              <div className="mt-2 text-xs text-secondary">
                支持 HTTPS 和 SSH 格式
              </div>
              {targetDirectory && (
                <div className="mt-3 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">
                  <div className="text-xs font-medium mb-1">下载目录</div>
                  <div className="text-xs text-secondary break-all">
                    {targetDirectory}
                    {repoUrl && (
                      <span className="text-[var(--color-text)]">
                        /{repoUrl.split('/').pop()?.replace('.git', '') || 'repo'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCloneDialog(false)
                  setRepoUrl('')
                  setTargetDirectory(null)
                  setError(null)
                }}
                disabled={cloning}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
              >
                取消
              </button>
              {!targetDirectory ? (
                <button
                  onClick={handleSelectTargetDirectory}
                  disabled={cloning}
                  className="px-4 py-2 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
                >
                  选择目录
                </button>
              ) : (
                <button
                  onClick={handleCloneFromGithub}
                  disabled={cloning || !repoUrl.trim()}
                  className="px-4 py-2 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
                >
                  {cloning ? '克隆中...' : '开始克隆'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
