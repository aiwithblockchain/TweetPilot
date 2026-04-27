import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { ToastProvider } from '@/contexts/ToastContext'
import { BlockingOverlayProvider } from '@/contexts/BlockingOverlayContext'
import { useAppLayoutState } from './useAppLayoutState'
import type { WorkspaceEntry, WorkspaceWatcherEvent } from '@/services/workspace'

const workspaceChangedListeners: Array<(event: { payload: string }) => void> = []
const workspaceFsChangedListeners: Array<(event: { payload: WorkspaceWatcherEvent }) => void> = []

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, callback: (event: { payload: string | WorkspaceWatcherEvent }) => void) => {
    if (eventName === 'workspace-changed') {
      workspaceChangedListeners.push(callback as (event: { payload: string }) => void)
    }
    if (eventName === 'workspace-fs-changed') {
      workspaceFsChangedListeners.push(callback as (event: { payload: WorkspaceWatcherEvent }) => void)
    }
    return () => {}
  }),
  emit: vi.fn(async () => undefined),
}))

const mocks = vi.hoisted(() => ({
  workspaceService: {
    getCurrentWorkspace: vi.fn(),
    listDirectory: vi.fn(),
    createFile: vi.fn(),
    createFolder: vi.fn(),
    deleteEntry: vi.fn(),
    getFolderSummary: vi.fn(),
    readFile: vi.fn(),
    startWorkspaceWatcher: vi.fn(),
    stopWorkspaceWatcher: vi.fn(),
  },
  getManagedAccounts: vi.fn(),
  getUnmanagedOnlineAccounts: vi.fn(),
  layoutGetInstances: vi.fn(),
}))

vi.mock('./useTasksSidebarItems', () => ({
  useTasksSidebarItems: () => ({
    tasks: [],
    items: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}))

vi.mock('@/services', () => ({
  workspaceService: mocks.workspaceService,
  dataBlocksService: {
    addCard: vi.fn(),
  },
  getManagedAccounts: mocks.getManagedAccounts,
  getUnmanagedOnlineAccounts: mocks.getUnmanagedOnlineAccounts,
}))

vi.mock('@/services/layout', () => ({
  layoutService: {
    getInstances: mocks.layoutGetInstances,
  },
}))

const initialRootEntries: WorkspaceEntry[] = [
  {
    path: '/workspace/src',
    name: 'src',
    kind: 'directory',
    hasChildren: true,
  },
]

const initialSrcEntries: WorkspaceEntry[] = [
  {
    path: '/workspace/src/index.ts',
    name: 'index.ts',
    kind: 'file',
    extension: 'ts',
  },
]

function HookHarness() {
  const state = useAppLayoutState()

  return (
    <div>
      <button type="button" onClick={() => state.handleSelectSidebarItem('/workspace/src/index.ts')}>
        选择文件
      </button>
      <button type="button" onClick={() => state.handleSelectSidebarItem('/workspace/src')}>
        选择目录
      </button>
      <button type="button" onClick={() => void state.handleSidebarAction('new-folder')}>
        新建文件夹
      </button>
      <button type="button" onClick={() => void state.handleSidebarAction('new-file')}>
        新建文件
      </button>
      <button type="button" onClick={() => void state.handleSidebarAction('refresh-workspace')}>
        刷新工作区
      </button>
      <button type="button" onClick={() => void state.handleSidebarAction('rename-workspace-entry')}>
        重命名项目
      </button>
      <button type="button" onClick={() => void state.handleSidebarAction('delete-workspace-entry')}>
        删除项目
      </button>
      <button type="button" onClick={() => state.updateWorkspaceInlineCreateValue('components')}>
        输入 components
      </button>
      <button type="button" onClick={() => state.updateWorkspaceInlineCreateValue('notes.md')}>
        输入 notes.md
      </button>
      <button type="button" onClick={() => void state.submitWorkspaceInlineCreate()}>
        提交创建
      </button>
      <button type="button" onClick={() => void state.confirmWorkspaceDelete()}>
        确认删除
      </button>

      <div data-testid="rename-active">{String(state.workspaceRenameState.active)}</div>
      <div data-testid="rename-path">{state.workspaceRenameState.path ?? ''}</div>
      <div data-testid="delete-open">{String(state.workspaceDeleteState.open)}</div>
      <div data-testid="delete-path">{state.workspaceDeleteState.path ?? ''}</div>
      <div data-testid="inline-active">{String(state.workspaceInlineCreate.active)}</div>
      <div data-testid="inline-kind">{state.workspaceInlineCreate.kind ?? ''}</div>
      <div data-testid="inline-parent">{state.workspaceInlineCreate.parentPath ?? ''}</div>
      <div data-testid="inline-value">{state.workspaceInlineCreate.value}</div>
      <div data-testid="inline-error">{state.workspaceInlineCreate.error ?? ''}</div>
      <div data-testid="selected-id">{state.selectedSidebarItemId ?? ''}</div>
      <div data-testid="refresh-error">{state.workspaceRefreshError ?? ''}</div>
      <div data-testid="tree-items">{state.workspaceTreeItems.map((item) => item.id).join('|')}</div>
    </div>
  )
}

function renderHarness() {
  return render(
    <ToastProvider>
      <BlockingOverlayProvider>
        <HookHarness />
      </BlockingOverlayProvider>
    </ToastProvider>
  )
}

afterEach(() => {
  cleanup()
})

describe('useAppLayoutState workspace explorer flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workspaceFsChangedListeners.length = 0
    mocks.workspaceService.getCurrentWorkspace.mockResolvedValue('/workspace')
    mocks.workspaceService.listDirectory.mockImplementation(async (path: string) => {
      if (path === '/workspace') return initialRootEntries
      if (path === '/workspace/src') return initialSrcEntries
      return []
    })
    mocks.workspaceService.createFile.mockResolvedValue({
      path: '/workspace/src/notes.md',
      name: 'notes.md',
      kind: 'file',
      extension: 'md',
    })
    mocks.workspaceService.createFolder.mockResolvedValue({
      path: '/workspace/src/components',
      name: 'components',
      kind: 'directory',
      hasChildren: false,
    })
    mocks.workspaceService.deleteEntry = vi.fn().mockResolvedValue(undefined)
    mocks.workspaceService.getFolderSummary.mockResolvedValue({
      path: '/workspace',
      name: 'workspace',
      itemCount: 1,
      folderCount: 1,
      fileCount: 0,
    })
    mocks.workspaceService.startWorkspaceWatcher.mockResolvedValue(undefined)
    mocks.workspaceService.stopWorkspaceWatcher.mockResolvedValue(undefined)
    mocks.getManagedAccounts.mockResolvedValue([])
    mocks.getUnmanagedOnlineAccounts.mockResolvedValue([])
    mocks.layoutGetInstances.mockResolvedValue([])
  })

  it('starts inline create under the selected file parent directory', async () => {
    renderHarness()

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace/src')
    })

    fireEvent.click(screen.getByText('选择文件'))
    fireEvent.click(screen.getByText('新建文件夹'))

    expect(screen.getByTestId('inline-active').textContent).toBe('true')
    expect(screen.getByTestId('inline-kind').textContent).toBe('folder')
    expect(screen.getByTestId('inline-parent').textContent).toBe('/workspace/src')
  })

  it('creates a workspace item and selects it after refresh', async () => {
    mocks.workspaceService.listDirectory.mockImplementation(async (path: string) => {
      if (path === '/workspace') return initialRootEntries
      if (path === '/workspace/src') {
        return [
          ...initialSrcEntries,
          {
            path: '/workspace/src/components',
            name: 'components',
            kind: 'directory',
            hasChildren: false,
          },
        ]
      }
      if (path === '/workspace/src/components') return []
      return []
    })

    renderHarness()

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace/src')
    })

    fireEvent.click(screen.getByText('选择文件'))
    fireEvent.click(screen.getByText('新建文件夹'))
    fireEvent.click(screen.getByText('输入 components'))
    fireEvent.click(screen.getByText('提交创建'))

    await waitFor(() => {
      expect(mocks.workspaceService.createFolder).toHaveBeenCalledWith({ parentPath: '/workspace/src', name: 'components' })
      expect(screen.getByTestId('selected-id').textContent).toBe('/workspace/src/components')
      expect(screen.getByTestId('inline-active').textContent).toBe('false')
    })
  })

  it('opens rename state for the selected workspace item', async () => {
    renderHarness()

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace/src')
    })

    fireEvent.click(screen.getByText('选择目录'))
    await waitFor(() => {
      expect(screen.getByTestId('selected-id').textContent).toBe('/workspace/src')
    })
    fireEvent.click(screen.getByText('重命名项目'))

    await waitFor(() => {
      expect(screen.getByTestId('rename-active').textContent).toBe('true')
      expect(screen.getByTestId('rename-path').textContent).toBe('/workspace/src')
    })
  })

  it('opens delete confirmation state for the selected workspace item', async () => {
    renderHarness()

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace/src')
    })

    fireEvent.click(screen.getByText('选择目录'))
    await waitFor(() => {
      expect(screen.getByTestId('selected-id').textContent).toBe('/workspace/src')
    })
    fireEvent.click(screen.getByText('删除项目'))

    await waitFor(() => {
      expect(screen.getByTestId('delete-open').textContent).toBe('true')
      expect(screen.getByTestId('delete-path').textContent).toBe('/workspace/src')
    })
  })

  it('closes delete state after successful deletion', async () => {
    renderHarness()

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace/src')
    })

    fireEvent.click(screen.getByText('选择目录'))
    fireEvent.click(screen.getByText('删除项目'))

    await waitFor(() => {
      expect(screen.getByTestId('delete-open').textContent).toBe('true')
    })

    mocks.workspaceService.listDirectory.mockImplementation(async (path: string) => {
      if (path === '/workspace') return []
      if (path === '/workspace/src') return []
      return []
    })

    fireEvent.click(screen.getByText('确认删除'))

    await waitFor(() => {
      expect(mocks.workspaceService.deleteEntry).toHaveBeenCalledWith('/workspace/src')
      expect(screen.getByTestId('delete-open').textContent).toBe('false')
      expect(screen.getByTestId('selected-id').textContent).toBe('/workspace')
    })
  })

  it('starts and stops workspace watcher with the active workspace', async () => {
    renderHarness()

    await waitFor(() => {
      expect(mocks.workspaceService.startWorkspaceWatcher).toHaveBeenCalledWith('/workspace')
    })
  })

  it('refreshes workspace tree after workspace fs change events', async () => {
    let rootEntries = initialRootEntries

    mocks.workspaceService.listDirectory.mockImplementation(async (path: string) => {
      if (path === '/workspace') return rootEntries
      if (path === '/workspace/src') return initialSrcEntries
      if (path === '/workspace/docs') return []
      return []
    })

    renderHarness()

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace/src')
      expect(workspaceFsChangedListeners.length).toBeGreaterThan(0)
    })

    rootEntries = [
      ...initialRootEntries,
      {
        path: '/workspace/docs',
        name: 'docs',
        kind: 'directory',
        hasChildren: false,
      },
    ]

    workspaceFsChangedListeners[workspaceFsChangedListeners.length - 1]({
      payload: { workspacePath: '/workspace' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace/docs')
    })
  })

  it('resets and reloads workspace-scoped state from the workspace-changed payload', async () => {
    mocks.workspaceService.listDirectory.mockImplementation(async (path: string) => {
      if (path === '/workspace') return initialRootEntries
      if (path === '/workspace-next') {
        return [
          {
            path: '/workspace-next/docs',
            name: 'docs',
            kind: 'directory',
            hasChildren: false,
          },
        ]
      }
      return []
    })

    renderHarness()

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace/src')
      expect(workspaceChangedListeners.length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText('选择目录'))
    fireEvent.click(screen.getByText('重命名项目'))

    await waitFor(() => {
      expect(screen.getByTestId('rename-active').textContent).toBe('true')
    })

    workspaceChangedListeners[workspaceChangedListeners.length - 1]({ payload: '/workspace-next' })

    await waitFor(() => {
      expect(screen.getByTestId('tree-items').textContent).toContain('/workspace-next/docs')
      expect(screen.getByTestId('tree-items').textContent).not.toContain('/workspace/src')
      expect(screen.getByTestId('selected-id').textContent).toBe('/workspace-next')
      expect(screen.getByTestId('rename-active').textContent).toBe('false')
      expect(screen.getByTestId('delete-open').textContent).toBe('false')
      expect(screen.getByTestId('inline-active').textContent).toBe('false')
    })

    expect(mocks.workspaceService.getCurrentWorkspace).toHaveBeenCalledTimes(1)
  })
})
