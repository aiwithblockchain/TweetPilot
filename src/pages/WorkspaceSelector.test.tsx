import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspaceSelector from './WorkspaceSelector'
import { workspaceService } from '@/services'

vi.mock('@/components/TitleBar', () => ({
  TitleBar: () => <div data-testid="title-bar" />,
}))

vi.mock('@/services', () => ({
  workspaceService: {
    selectLocalDirectory: vi.fn(),
    getRecentWorkspaces: vi.fn().mockResolvedValue([]),
    checkDirectoryExists: vi.fn().mockResolvedValue(true),
    cloneFromGithub: vi.fn(),
  },
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

afterEach(() => {
  cleanup()
})

describe('WorkspaceSelector integration flow', () => {
  const onWorkspaceSelected = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceService.getRecentWorkspaces).mockResolvedValue([])
    vi.mocked(workspaceService.checkDirectoryExists).mockResolvedValue(true)
    onWorkspaceSelected.mockReset()
  })

  it('opens the selected workspace and notifies the app shell', async () => {
    vi.mocked(workspaceService.selectLocalDirectory).mockResolvedValue('/tmp/tweetpilot-workspace')
    onWorkspaceSelected.mockResolvedValue(undefined)

    render(
      <WorkspaceSelector currentWorkspace={null} onWorkspaceSelected={onWorkspaceSelected} />
    )

    fireEvent.click(screen.getByText('📁 选择本地目录'))

    await waitFor(() => {
      expect(workspaceService.selectLocalDirectory).toHaveBeenCalledTimes(1)
      expect(onWorkspaceSelected).toHaveBeenCalledWith('/tmp/tweetpilot-workspace')
    })
  })

  it('stays on the selector when the folder picker is canceled', async () => {
    vi.mocked(workspaceService.selectLocalDirectory).mockResolvedValue(null)

    render(
      <WorkspaceSelector currentWorkspace={null} onWorkspaceSelected={onWorkspaceSelected} />
    )

    fireEvent.click(screen.getByText('📁 选择本地目录'))

    await waitFor(() => {
      expect(workspaceService.selectLocalDirectory).toHaveBeenCalledTimes(1)
    })

    expect(onWorkspaceSelected).not.toHaveBeenCalled()
  })

  it('disables actions while a workspace is initializing', () => {
    render(
      <WorkspaceSelector
        currentWorkspace="/tmp/tweetpilot-workspace"
        isInitializingWorkspace
        onWorkspaceSelected={onWorkspaceSelected}
      />
    )

    const openButton = screen.getAllByText('📁 选择本地目录')[0].closest('button')
    const cloneButton = screen.getAllByText('🔗 从 GitHub 克隆')[0].closest('button')

    expect(openButton?.hasAttribute('disabled')).toBe(true)
    expect(cloneButton?.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('正在打开工作目录...')).toBeTruthy()
  })
})
