import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspaceSelector from './WorkspaceSelector'
import { workspaceService } from '@/services'

vi.mock('@/services', () => ({
  workspaceService: {
    selectLocalDirectory: vi.fn(),
    setCurrentWorkspace: vi.fn(),
  },
}))

describe('WorkspaceSelector integration flow', () => {
  const onWorkspaceSelected = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists the selected workspace and notifies the app shell', async () => {
    vi.mocked(workspaceService.selectLocalDirectory).mockResolvedValue('/tmp/tweetpilot-workspace')
    vi.mocked(workspaceService.setCurrentWorkspace).mockResolvedValue(undefined)

    render(
      <WorkspaceSelector currentWorkspace={null} onWorkspaceSelected={onWorkspaceSelected} />
    )

    fireEvent.click(screen.getByText('📁 选择本地目录'))

    await waitFor(() => {
      expect(workspaceService.selectLocalDirectory).toHaveBeenCalledTimes(1)
      expect(workspaceService.setCurrentWorkspace).toHaveBeenCalledWith('/tmp/tweetpilot-workspace')
      expect(onWorkspaceSelected).toHaveBeenCalledWith('/tmp/tweetpilot-workspace')
    })
  })

  it('stays on the selector when the folder picker is canceled', async () => {
    vi.mocked(workspaceService.selectLocalDirectory).mockResolvedValue(null)

    render(
      <WorkspaceSelector currentWorkspace={null} onWorkspaceSelected={onWorkspaceSelected} />
    )

    const buttons = screen.getAllByText('📁 选择本地目录')
    fireEvent.click(buttons[0])

    await waitFor(() => {
      expect(workspaceService.selectLocalDirectory).toHaveBeenCalledTimes(1)
    })

    expect(workspaceService.setCurrentWorkspace).not.toHaveBeenCalled()
    expect(onWorkspaceSelected).not.toHaveBeenCalled()
  })
})
