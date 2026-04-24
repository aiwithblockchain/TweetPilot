import { useState, useEffect, useCallback, useRef } from 'react'
import WorkspaceSelector from './pages/WorkspaceSelector'
import { TitleBar } from './components/TitleBar'
import { ActivityBar } from './components/ActivityBar'
import { ResizableDivider } from './components/ResizableDivider'
import { LeftSidebar } from './components/LeftSidebar'
import { RightPanel } from './components/RightPanel'
import { EditorTabsBar } from './components/EditorTabsBar'
import { CenterContentRouter } from './components/CenterContentRouter'
import { SettingsDialog } from './components/SettingsDialog'
import { AddDataBlockMenu } from './components/AddDataBlockMenu'
import ConfirmDialog from './components/ui/ConfirmDialog'
import { ToastProvider } from './contexts/ToastContext'
import { taskService } from './services'
import { useAppLayoutState } from './hooks/useAppLayoutState'
import { settingsService } from './services'
import type { AppSettings } from './services/settings'
import './styles/vscode-theme.css'

function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement

  if (theme === 'light') {
    root.classList.remove('dark')
    return
  }

  if (theme === 'dark') {
    root.classList.add('dark')
    return
  }

  // system theme
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (prefersDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function AppShell() {
  const {
    activeView,
    centerMode,
    currentSidebarItems,
    currentSidebarSection,
    dataBlockMenuOpen,
    handleActivateTab,
    handleAddDataBlock,
    handleCloseTab,
    handleSelectSidebarItem,
    handleSidebarAction,
    handleTaskCreated,
    handleTaskDeleted,
    handleToggleWorkspaceItem,
    handleViewChange,
    managedAccounts,
    unmanagedAccounts,
    reloadAccounts,
    instances,
    isCompactLayout,
    leftSidebarVisible,
    leftWidth,
    mobileSidebarOpen,
    openSettingsDialog,
    openTabs,
    persistLeftWidth,
    persistRightPanelVisible,
    persistRightWidth,
    rightPanelVisible,
    rightWidth,
    selectedSidebarItem,
    selectedSidebarItemId,
    setMobileSidebarOpen,
    settingsDialogOpen,
    settingsInitialSection,
    clearAccountsSelection,
    closeDataBlockMenu,
    closeSettingsDialog,
    toggleLeftSidebarVisible,
    toggleRightPanelVisible,
    workspaceDetailLoading,
    workspaceError,
    workspaceFileContent,
    workspaceFolderSummary,
    workspaceInlineCreate,
    workspaceRenameState,
    workspaceDeleteState,
    workspaceRecentMutation,
    workspaceRefreshPending,
    workspaceRefreshError,
    workspaceTreeItems,
    cancelWorkspaceInlineCreate,
    submitWorkspaceInlineCreate,
    updateWorkspaceInlineCreateValue,
    cancelWorkspaceRename,
    closeWorkspaceDeleteDialog,
    confirmWorkspaceDelete,
    submitWorkspaceRename,
    updateWorkspaceRenameValue,
  } = useAppLayoutState()

  const [taskEditState, setTaskEditState] = useState<{
    taskId: string
    taskName: string
    isEditing: boolean
    hasUnsavedChanges: boolean
  }>({
    taskId: '',
    taskName: '',
    isEditing: false,
    hasUnsavedChanges: false,
  })

  const [unsavedTaskSwitchDialog, setUnsavedTaskSwitchDialog] = useState<{
    open: boolean
    currentTaskId: string
    currentTaskName: string
    nextTaskId: string
    nextTaskName: string
  }>({
    open: false,
    currentTaskId: '',
    currentTaskName: '',
    nextTaskId: '',
    nextTaskName: '',
  })

  useEffect(() => {
    // Ensure cleanup of pending workspace path after entering main interface
    const pendingPath = sessionStorage.getItem('pending-workspace-path')
    if (pendingPath) {
      console.log('[AppShell] Cleaning up pending workspace path')
      sessionStorage.removeItem('pending-workspace-path')
    }
  }, [])

  const closeUnsavedTaskSwitchDialog = () => {
    setUnsavedTaskSwitchDialog((prev) => ({
      ...prev,
      open: false,
    }))
  }

  const handleRequestTaskSwitch = async ({
    currentTaskId,
    currentTaskName,
    nextTaskId,
  }: {
    currentTaskId: string
    currentTaskName: string
    nextTaskId: string
  }) => {
    if (!nextTaskId || nextTaskId === currentTaskId) {
      return
    }

    try {
      const detail = await taskService.getTaskDetail(nextTaskId)
      setUnsavedTaskSwitchDialog({
        open: true,
        currentTaskId,
        currentTaskName,
        nextTaskId,
        nextTaskName: detail.task.name,
      })
    } catch {
      setUnsavedTaskSwitchDialog({
        open: true,
        currentTaskId,
        currentTaskName,
        nextTaskId,
        nextTaskName: '目标任务',
      })
    }
  }

  const handleTaskEditStateChange = (state: {
    taskId: string
    taskName: string
    isEditing: boolean
    hasUnsavedChanges: boolean
  }) => {
    setTaskEditState(state)

    if (
      unsavedTaskSwitchDialog.open &&
      unsavedTaskSwitchDialog.currentTaskId === state.taskId &&
      !state.isEditing
    ) {
      closeUnsavedTaskSwitchDialog()
    }
  }

  const guardedHandleSelectSidebarItem = (itemId: string) => {
    if (activeView !== 'tasks') {
      handleSelectSidebarItem(itemId)
      return
    }

    if (unsavedTaskSwitchDialog.open) {
      return
    }

    if (
      taskEditState.isEditing &&
      taskEditState.hasUnsavedChanges &&
      taskEditState.taskId &&
      taskEditState.taskId !== itemId
    ) {
      void handleRequestTaskSwitch({
        currentTaskId: taskEditState.taskId,
        currentTaskName: taskEditState.taskName,
        nextTaskId: itemId,
      })
      return
    }

    handleSelectSidebarItem(itemId)
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <TitleBar
        leftSidebarVisible={leftSidebarVisible}
        rightPanelVisible={rightPanelVisible}
        onToggleLeftSidebar={toggleLeftSidebarVisible}
        onToggleRightPanel={toggleRightPanelVisible}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <ActivityBar activeView={activeView} onViewChange={handleViewChange} onOpenSettings={openSettingsDialog} />

        {leftSidebarVisible && (
          <div className={isCompactLayout ? 'hidden md:flex' : 'flex'}>
            <LeftSidebar
              activeView={activeView}
              width={leftWidth}
              items={currentSidebarItems}
              treeItems={workspaceTreeItems}
              section={currentSidebarSection}
              selectedItemId={selectedSidebarItemId}
              workspaceInlineCreate={workspaceInlineCreate}
              workspaceRenameState={workspaceRenameState}
              workspaceDeleteState={workspaceDeleteState}
              workspaceRecentMutation={workspaceRecentMutation}
              workspaceRefreshPending={workspaceRefreshPending}
              workspaceRefreshError={workspaceRefreshError}
              onAction={handleSidebarAction}
              onSelectItem={guardedHandleSelectSidebarItem}
              onToggleTreeItem={handleToggleWorkspaceItem}
              onWorkspaceInlineCreateChange={updateWorkspaceInlineCreateValue}
              onWorkspaceInlineCreateSubmit={submitWorkspaceInlineCreate}
              onWorkspaceInlineCreateCancel={cancelWorkspaceInlineCreate}
              onWorkspaceRenameChange={updateWorkspaceRenameValue}
              onWorkspaceRenameSubmit={submitWorkspaceRename}
              onWorkspaceRenameCancel={cancelWorkspaceRename}
            />
            <ResizableDivider side="left" onResize={persistLeftWidth} isVisible={!isCompactLayout} />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[var(--color-bg)] transition-opacity duration-200 ease-out">
          <EditorTabsBar
            activeTab={activeView}
            openTabs={openTabs}
            isCompactLayout={isCompactLayout}
            rightPanelVisible={rightPanelVisible}
            onActivateTab={handleActivateTab}
            onCloseTab={handleCloseTab}
            onToggleRightPanel={toggleRightPanelVisible}
            mobileSidebarTrigger={{
              activeView,
              items: currentSidebarItems,
              treeItems: workspaceTreeItems,
              section: currentSidebarSection,
              selectedItemId: selectedSidebarItemId,
              mobileSidebarOpen,
              workspaceInlineCreate,
              workspaceRenameState,
              workspaceDeleteState,
              workspaceRefreshPending,
              workspaceRefreshError,
              onAction: handleSidebarAction,
              onClose: () => setMobileSidebarOpen(false),
              onOpen: () => setMobileSidebarOpen(true),
              onSelectItem: guardedHandleSelectSidebarItem,
              onToggleTreeItem: handleToggleWorkspaceItem,
              onWorkspaceInlineCreateChange: updateWorkspaceInlineCreateValue,
              onWorkspaceInlineCreateSubmit: submitWorkspaceInlineCreate,
              onWorkspaceInlineCreateCancel: cancelWorkspaceInlineCreate,
              onWorkspaceRenameChange: updateWorkspaceRenameValue,
              onWorkspaceRenameSubmit: submitWorkspaceRename,
              onWorkspaceRenameCancel: cancelWorkspaceRename,
            }}
          />

          <div className="flex-1 min-h-0 overflow-auto">
            <CenterContentRouter
              activeView={activeView}
              selectedSidebarItem={selectedSidebarItem}
              centerMode={centerMode}
              instances={instances}
              managedAccounts={managedAccounts}
              unmanagedAccounts={unmanagedAccounts}
              onAccountsMutated={reloadAccounts}
              onAccountSelectionCleared={clearAccountsSelection}
              workspaceFileContent={workspaceFileContent}
              workspaceFolderSummary={workspaceFolderSummary}
              workspaceLoading={workspaceDetailLoading}
              workspaceError={workspaceError}
              workspaceRenameState={workspaceRenameState}
              workspaceDeleteState={workspaceDeleteState}
              onWorkspaceRename={() => void handleSidebarAction('rename-workspace-entry')}
              onWorkspaceDelete={() => void handleSidebarAction('delete-workspace-entry')}
              onTaskCreated={handleTaskCreated}
              onTaskDeleted={handleTaskDeleted}
              onTaskEditStateChange={handleTaskEditStateChange}
            />
          </div>
        </div>

        {rightPanelVisible && !isCompactLayout && (
          <>
            <ResizableDivider side="right" onResize={persistRightWidth} isVisible={rightPanelVisible} />
            <RightPanel width={rightWidth} onToggle={() => persistRightPanelVisible(false)} onOpenSettings={openSettingsDialog} />
          </>
        )}
      </div>

      <SettingsDialog open={settingsDialogOpen} onClose={closeSettingsDialog} initialSection={settingsInitialSection} />
      <AddDataBlockMenu open={dataBlockMenuOpen} onClose={closeDataBlockMenu} onSelect={handleAddDataBlock} />
      <ConfirmDialog
        open={unsavedTaskSwitchDialog.open}
        title="放弃未保存的修改？"
        message={`你正在编辑《${unsavedTaskSwitchDialog.currentTaskName || '当前任务'}》，是否放弃修改并切换到《${unsavedTaskSwitchDialog.nextTaskName || '目标任务'}》？`}
        confirmText="放弃并切换"
        cancelText="继续编辑"
        danger
        onConfirm={() => {
          const nextTaskId = unsavedTaskSwitchDialog.nextTaskId
          closeUnsavedTaskSwitchDialog()
          if (nextTaskId) {
            handleSelectSidebarItem(nextTaskId)
          }
        }}
        onCancel={closeUnsavedTaskSwitchDialog}
      />
      <ConfirmDialog
        open={workspaceDeleteState.open}
        title="确认删除"
        message={workspaceDeleteState.error ? `${workspaceDeleteState.error}` : `确定要删除 ${workspaceDeleteState.label || '当前项目'} 吗？该操作不可恢复。`}
        confirmText={workspaceDeleteState.pending ? '删除中...' : '确认删除'}
        cancelText="取消"
        danger
        onConfirm={confirmWorkspaceDelete}
        onCancel={closeWorkspaceDeleteDialog}
      />
    </div>
  )
}

function AppContent() {
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)
  const [isCheckingWorkspace, setIsCheckingWorkspace] = useState(true)
  const [isInitializingWorkspace, setIsInitializingWorkspace] = useState(false)
  const initializingWorkspacePathsRef = useRef<Set<string>>(new Set())

  const initializeWorkspace = useCallback(async (path: string) => {
    const normalizedPath = path.trim()
    if (!normalizedPath) {
      return false
    }

    if (initializingWorkspacePathsRef.current.has(normalizedPath)) {
      console.log('[App] Skipping duplicate workspace initialization:', normalizedPath)
      return false
    }

    console.log('[App] Initializing workspace:', normalizedPath)
    initializingWorkspacePathsRef.current.add(normalizedPath)
    setIsInitializingWorkspace(true)

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('set_current_workspace', { path: normalizedPath })
      console.log('[App] Backend initialized successfully')
      setCurrentWorkspace(normalizedPath)
      setWorkspaceReady(true)
      return true
    } catch (error) {
      console.error('[App] Failed to initialize workspace:', error)
      return false
    } finally {
      initializingWorkspacePathsRef.current.delete(normalizedPath)
      setIsInitializingWorkspace(initializingWorkspacePathsRef.current.size > 0)
    }
  }, [])

  useEffect(() => {
    const pendingPath = sessionStorage.getItem('pending-workspace-path')

    if (pendingPath) {
      console.log('[App] Restoring pending workspace after reload:', pendingPath)
      sessionStorage.removeItem('pending-workspace-path')
      setCurrentWorkspace(pendingPath)
      setWorkspaceReady(true)
      setIsCheckingWorkspace(false)
      return
    }

    // Don't auto-load workspace - always show selector on startup
    console.log('[App] Starting app, will show workspace selector')
    setIsCheckingWorkspace(false)
  }, [])

  useEffect(() => {
    const setupEventListeners = async () => {
      const { listen } = await import('@tauri-apps/api/event')

      const unlistenWorkspaceChanged = await listen<string>('workspace-changed', (event) => {
        console.log('[App] Workspace changed via menu:', event.payload)
        // Backend state is already switched by the Rust command, persist path for frontend reload only.
        sessionStorage.setItem('pending-workspace-path', event.payload)
        setCurrentWorkspace(event.payload)
        setWorkspaceReady(true)
        setTimeout(() => window.location.reload(), 100)
      })

      const unlistenSetInitialWorkspace = await listen<string>('set-initial-workspace', (event) => {
        console.log('[App] Set initial workspace for new window:', event.payload)
        void initializeWorkspace(event.payload).finally(() => {
          setIsCheckingWorkspace(false)
        })
      })

      return () => {
        unlistenWorkspaceChanged()
        unlistenSetInitialWorkspace()
      }
    }

    const cleanup = setupEventListeners()
    return () => {
      cleanup.then(fn => fn())
    }
  }, [initializeWorkspace])

  const handleWorkspaceSelected = useCallback(async (path: string) => {
    console.log('[App] Workspace selected:', path)
    await initializeWorkspace(path)
  }, [initializeWorkspace])

  if (isCheckingWorkspace) {
    return null
  }

  if (!workspaceReady) {
    return (
      <WorkspaceSelector
        currentWorkspace={currentWorkspace}
        isInitializingWorkspace={isInitializingWorkspace}
        onWorkspaceSelected={handleWorkspaceSelected}
      />
    )
  }

  return <AppShell />
}

function App() {
  useEffect(() => {
    // Initialize theme on app startup
    const initTheme = async () => {
      try {
        const settings = await settingsService.getSettings()
        applyTheme(settings.theme)
      } catch (error) {
        console.error('Failed to load theme settings:', error)
        // Fallback to dark theme
        applyTheme('dark')
      }
    }

    void initTheme()
  }, [])

  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
