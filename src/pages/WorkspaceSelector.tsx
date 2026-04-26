import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { workspaceService } from '@/services'
import type { WorkspaceHistory } from '@/services/workspace'
import { listen } from '@tauri-apps/api/event'
import { TitleBar } from '@/components/TitleBar'

interface WorkspaceSelectorProps {
  currentWorkspace: string | null
  isInitializingWorkspace?: boolean
  onWorkspaceSelected: (path: string) => void | Promise<void>
}

export default function WorkspaceSelector({
  currentWorkspace,
  isInitializingWorkspace = false,
  onWorkspaceSelected,
}: WorkspaceSelectorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [cloning, setCloning] = useState(false)
  const [targetDirectory, setTargetDirectory] = useState<string | null>(null)
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceHistory[]>([])
  const [showRecentWorkspaces, setShowRecentWorkspaces] = useState(false)
  const [cloneProgress, setCloneProgress] = useState<string>('')
  const [recentMutationPath, setRecentMutationPath] = useState<string | null>(null)

  useEffect(() => {
    void loadRecentWorkspaces()
  }, [])

  const loadRecentWorkspaces = async () => {
    try {
      const recent = await workspaceService.getRecentWorkspaces()
      const recentWithStatus = await Promise.all(
        recent.map(async (workspace) => {
          try {
            const exists = await workspaceService.checkDirectoryExists(workspace.path)
            return {
              ...workspace,
              exists,
            }
          } catch {
            return {
              ...workspace,
              exists: false,
            }
          }
        }),
      )
      setRecentWorkspaces(recentWithStatus)
    } catch (err) {
      console.error('Failed to load recent workspaces:', err)
    }
  }

  const handleOpenWorkspace = async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      await onWorkspaceSelected(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : '打开工作目录失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDirectory = async () => {
    setLoading(true)
    setError(null)

    try {
      const path = await workspaceService.selectLocalDirectory()

      if (!path) {
        return
      }

      await onWorkspaceSelected(path)
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
    setCloneProgress('')

    const unlisten = await listen<string>('clone-progress', (event) => {
      setCloneProgress(event.payload)
    })

    try {
      const path = await workspaceService.cloneFromGithub(repoUrl.trim(), targetDirectory)
      setShowCloneDialog(false)
      setRepoUrl('')
      setTargetDirectory(null)
      setCloneProgress('')
      await onWorkspaceSelected(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : '克隆失败')
    } finally {
      setCloning(false)
      unlisten()
    }
  }

  const handleDeleteRecentWorkspace = async (event: MouseEvent, path: string) => {
    event.stopPropagation()
    event.preventDefault()
    setRecentMutationPath(path)
    setError(null)

    try {
      await workspaceService.deleteRecentWorkspace(path)
      await loadRecentWorkspaces()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除最近工作目录失败')
    } finally {
      setRecentMutationPath(null)
    }
  }

  const isBusy = loading || cloning || isInitializingWorkspace

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)]">
      <TitleBar
        leftSidebarVisible={false}
        rightPanelVisible={false}
        onToggleLeftSidebar={() => {}}
        onToggleRightPanel={() => {}}
      />
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl w-full px-8">
          <div className="text-center mb-12">
            <h1 className="text-2xl font-semibold mb-3 text-white">TweetPilot</h1>
            <p className="text-base text-[var(--color-text)]">
              选择一个工作目录开始使用
            </p>
            {currentWorkspace && !isBusy && (
              <p className="mt-2 text-xs text-[var(--color-text-secondary)] break-all">
                当前选择: {currentWorkspace}
              </p>
            )}
          </div>

          <div className="grid gap-4">
            <button
              onClick={handleSelectDirectory}
              disabled={isBusy}
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[#6D5BF6] transition-colors text-left disabled:opacity-50"
            >
              <div className="text-base font-medium mb-1 text-[var(--color-text)]">📁 选择本地目录</div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                选择一个现有的目录作为工作目录
              </div>
            </button>

            <button
              onClick={() => setShowCloneDialog(true)}
              disabled={isBusy}
              className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[#6D5BF6] transition-colors text-left disabled:opacity-50"
            >
              <div className="text-base font-medium mb-1 text-[var(--color-text)]">🔗 从 GitHub 克隆</div>
              <div className="text-xs text-[var(--color-text-secondary)]">
                克隆一个 GitHub 仓库作为工作目录
              </div>
            </button>

            {recentWorkspaces.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-[var(--color-text-secondary)]">最近使用</div>
                {recentWorkspaces.slice(0, 3).map((workspace) => (
                  <div
                    key={workspace.path}
                    className="w-full p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[#6D5BF6] transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => void handleOpenWorkspace(workspace.path)}
                        disabled={isBusy}
                        className="flex-1 min-w-0 text-left cursor-pointer disabled:cursor-not-allowed"
                      >
                        <div className="text-sm font-medium mb-1 text-[var(--color-text)]">
                          {workspace.name}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] truncate">
                          {workspace.path}
                        </div>
                        {workspace.exists === false && (
                          <div className="mt-2 text-xs text-red-400">
                            目录不存在，但可从历史记录中删除
                          </div>
                        )}
                      </button>
                      <button
                        onClick={(event) => void handleDeleteRecentWorkspace(event, workspace.path)}
                        disabled={isBusy || recentMutationPath === workspace.path}
                        className="shrink-0 px-3 py-1.5 text-xs border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:text-red-400 hover:border-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {recentMutationPath === workspace.path ? '删除中...' : '删除'}
                      </button>
                    </div>
                  </div>
                ))}
                {recentWorkspaces.length > 3 && (
                  <button
                    onClick={() => setShowRecentWorkspaces(true)}
                    disabled={isBusy}
                    className="w-full p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[#6D5BF6] transition-colors text-center text-sm text-[var(--color-text-secondary)] disabled:opacity-50"
                  >
                    查看全部 {recentWorkspaces.length} 个工作目录
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
              {error}
            </div>
          )}

          {isBusy && (
            <div className="mt-4 text-center text-[var(--color-text-secondary)]">
              {cloning ? '正在克隆仓库...' : '正在打开工作目录...'}
            </div>
          )}
        </div>
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
                disabled={cloning || isInitializingWorkspace}
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

            {cloning && cloneProgress && (
              <div className="mb-4 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded">
                <div className="text-xs font-medium mb-2">克隆进度</div>
                <div className="text-xs text-secondary font-mono max-h-32 overflow-auto whitespace-pre-wrap">
                  {cloneProgress}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCloneDialog(false)
                  setRepoUrl('')
                  setTargetDirectory(null)
                  setError(null)
                }}
                disabled={cloning || isInitializingWorkspace}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
              >
                取消
              </button>
              {!targetDirectory ? (
                <button
                  onClick={handleSelectTargetDirectory}
                  disabled={cloning || isInitializingWorkspace}
                  className="px-4 py-2 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
                >
                  选择目录
                </button>
              ) : (
                <button
                  onClick={handleCloneFromGithub}
                  disabled={cloning || isInitializingWorkspace || !repoUrl.trim()}
                  className="px-4 py-2 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
                >
                  {cloning ? '克隆中...' : '开始克隆'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecentWorkspaces && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold mb-4">最近使用的工作目录</h3>

            <div className="flex-1 overflow-auto space-y-2">
              {recentWorkspaces.map((workspace) => (
                <div
                  key={workspace.path}
                  className="w-full p-4 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg hover:border-[#6D5BF6] transition-colors disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => {
                        setShowRecentWorkspaces(false)
                        void handleOpenWorkspace(workspace.path)
                      }}
                      disabled={isBusy}
                      className="flex-1 min-w-0 text-left cursor-pointer disabled:cursor-not-allowed"
                    >
                      <div className="text-sm font-medium mb-1">{workspace.name}</div>
                      <div className="text-xs text-secondary break-all">{workspace.path}</div>
                      <div className="text-xs text-secondary mt-1">
                        最后访问: {new Date(workspace.lastAccessed).toLocaleString('zh-CN')}
                      </div>
                      {workspace.exists === false && (
                        <div className="mt-2 text-xs text-red-400">
                          目录不存在，但可从历史记录中删除
                        </div>
                      )}
                    </button>
                    <button
                      onClick={(event) => void handleDeleteRecentWorkspace(event, workspace.path)}
                      disabled={isBusy || recentMutationPath === workspace.path}
                      className="shrink-0 px-3 py-1.5 text-xs border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:text-red-400 hover:border-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {recentMutationPath === workspace.path ? '删除中...' : '删除'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={() => setShowRecentWorkspaces(false)}
                className="px-4 py-2 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
