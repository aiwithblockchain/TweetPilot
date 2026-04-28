import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauriMocks.invoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: tauriMocks.listen,
}))

vi.mock('./services', () => ({
  taskService: {
    getTaskDetail: vi.fn(),
  },
  settingsService: {
    getSettings: vi.fn().mockResolvedValue({
      language: 'zh-CN',
      theme: 'dark',
    }),
  },
}))

vi.mock('./hooks/useAppLayoutState', () => ({
  useAppLayoutState: () => ({
    activeView: 'workspace',
    centerMode: 'empty',
    currentSidebarItems: [],
    currentSidebarSection: null,
    dataBlockMenuOpen: false,
    handleActivateTab: vi.fn(),
    handleAddDataBlock: vi.fn(),
    handleCloseTab: vi.fn(),
    handleSelectSidebarItem: vi.fn(),
    handleSidebarAction: vi.fn(),
    handleTaskCreated: vi.fn(),
    handleTaskDeleted: vi.fn(),
    handleToggleWorkspaceItem: vi.fn(),
    handleViewChange: vi.fn(),
    managedAccounts: [],
    unmanagedAccounts: [],
    reloadAccounts: vi.fn(),
    instances: [],
    isCompactLayout: false,
    leftSidebarVisible: true,
    leftWidth: 280,
    mobileSidebarOpen: false,
    openSettingsDialog: vi.fn(),
    openTabs: [],
    persistLeftWidth: vi.fn(),
    persistRightPanelVisible: vi.fn(),
    persistRightWidth: vi.fn(),
    rightPanelVisible: false,
    rightWidth: 320,
    selectedSidebarItem: null,
    selectedSidebarItemId: null,
    setMobileSidebarOpen: vi.fn(),
    settingsDialogOpen: false,
    settingsInitialSection: 'general',
    clearAccountsSelection: vi.fn(),
    closeDataBlockMenu: vi.fn(),
    closeSettingsDialog: vi.fn(),
    toggleLeftSidebarVisible: vi.fn(),
    toggleRightPanelVisible: vi.fn(),
    workspaceDetailLoading: false,
    workspaceError: null,
    workspaceFileContent: null,
    workspaceFolderSummary: null,
    workspaceInlineCreate: { active: false, kind: null, parentPath: null, value: '', error: null },
    workspaceRenameState: { active: false, path: null, value: '', error: null },
    workspaceDeleteState: { open: false, pending: false, path: null, label: null, error: null },
    workspaceRecentMutation: null,
    workspaceRefreshPending: false,
    workspaceRefreshError: null,
    workspaceTreeItems: [],
    cancelWorkspaceInlineCreate: vi.fn(),
    submitWorkspaceInlineCreate: vi.fn(),
    updateWorkspaceInlineCreateValue: vi.fn(),
    cancelWorkspaceRename: vi.fn(),
    closeWorkspaceDeleteDialog: vi.fn(),
    confirmWorkspaceDelete: vi.fn(),
    submitWorkspaceRename: vi.fn(),
    updateWorkspaceRenameValue: vi.fn(),
  }),
}))

vi.mock('./pages/WorkspaceSelector', () => ({
  default: ({ currentWorkspace }: { currentWorkspace: string | null }) => (
    <div data-testid="workspace-selector">{currentWorkspace ?? 'selector'}</div>
  ),
}))

vi.mock('./components/TitleBar', () => ({
  TitleBar: () => <div data-testid="title-bar" />,
}))

vi.mock('./components/ActivityBar', () => ({
  ActivityBar: () => <div data-testid="activity-bar" />,
}))

vi.mock('./components/ResizableDivider', () => ({
  ResizableDivider: () => <div data-testid="resizable-divider" />,
}))

vi.mock('./components/LeftSidebar', () => ({
  LeftSidebar: () => <div data-testid="left-sidebar" />,
}))

vi.mock('./components/RightPanel', () => ({
  RightPanel: () => <div data-testid="right-panel" />,
}))

vi.mock('./components/EditorTabsBar', () => ({
  EditorTabsBar: () => <div data-testid="editor-tabs-bar" />,
}))

vi.mock('./components/CenterContentRouter', () => ({
  CenterContentRouter: () => <div data-testid="center-content-router" />,
}))

vi.mock('./components/SettingsDialog', () => ({
  SettingsDialog: () => null,
}))

vi.mock('./components/AddDataBlockMenu', () => ({
  AddDataBlockMenu: () => null,
}))

vi.mock('./components/ui/ConfirmDialog', () => ({
  default: () => null,
}))

afterEach(() => {
  cleanup()
})

describe('App runtime workspace flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tauriMocks.listen.mockResolvedValue(() => {})
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'get_current_workspace') {
        return null
      }
      return undefined
    })
  })

  it('shows the selector when no runtime workspace exists', async () => {
    render(<App />)

    await waitFor(() => {
      expect(tauriMocks.invoke).toHaveBeenCalledWith('get_current_workspace')
      expect(tauriMocks.listen).toHaveBeenCalledTimes(1)
      expect(tauriMocks.listen).toHaveBeenCalledWith('workspace-changed', expect.any(Function))
      expect(screen.getByTestId('workspace-selector').textContent).toBe('selector')
    })
  })

  it('restores the runtime workspace after reload without sessionStorage bridging', async () => {
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'get_current_workspace') {
        return '/tmp/runtime-workspace'
      }
      return undefined
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.queryByTestId('workspace-selector')).toBeNull()
      expect(screen.getByTestId('title-bar')).toBeTruthy()
    })
  })
})
