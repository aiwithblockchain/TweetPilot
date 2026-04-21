import { useState, useEffect } from 'react'
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
import { ToastProvider } from './contexts/ToastContext'
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
    closeDataBlockMenu,
    closeSettingsDialog,
    toggleLeftSidebarVisible,
    toggleRightPanelVisible,
    workspaceDetailLoading,
    workspaceError,
    workspaceFileContent,
    workspaceFolderSummary,
    workspaceTreeItems,
  } = useAppLayoutState()

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
              onAction={handleSidebarAction}
              onSelectItem={handleSelectSidebarItem}
              onToggleTreeItem={handleToggleWorkspaceItem}
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
              section: currentSidebarSection,
              selectedItemId: selectedSidebarItemId,
              mobileSidebarOpen,
              onAction: handleSidebarAction,
              onClose: () => setMobileSidebarOpen(false),
              onOpen: () => setMobileSidebarOpen(true),
              onSelectItem: handleSelectSidebarItem,
            }}
          />

          <div className="flex-1 min-h-0 overflow-auto">
            <CenterContentRouter
              activeView={activeView}
              selectedSidebarItem={selectedSidebarItem}
              centerMode={centerMode}
              instances={instances}
              workspaceFileContent={workspaceFileContent}
              workspaceFolderSummary={workspaceFolderSummary}
              workspaceLoading={workspaceDetailLoading}
              workspaceError={workspaceError}
              onTaskCreated={handleTaskCreated}
              onTaskDeleted={handleTaskDeleted}
            />
          </div>
        </div>

        {rightPanelVisible && !isCompactLayout && (
          <>
            <ResizableDivider side="right" onResize={persistRightWidth} isVisible={rightPanelVisible} />
            <RightPanel width={rightWidth} onToggle={() => persistRightPanelVisible(false)} />
          </>
        )}
      </div>

      <SettingsDialog open={settingsDialogOpen} onClose={closeSettingsDialog} />
      <AddDataBlockMenu open={dataBlockMenuOpen} onClose={closeDataBlockMenu} onSelect={handleAddDataBlock} />
    </div>
  )
}

function AppContent() {
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [currentWorkspace, setCurrentWorkspace] = useState<string | null>(null)

  const handleWorkspaceSelected = (path: string) => {
    console.log('[App] Workspace selected:', path)
    setCurrentWorkspace(path)
    setWorkspaceReady(true)
  }

  if (!workspaceReady) {
    return <WorkspaceSelector currentWorkspace={currentWorkspace} onWorkspaceSelected={handleWorkspaceSelected} />
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
