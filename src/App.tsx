import { useState } from 'react'
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
import './styles/vscode-theme.css'

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
    <div className="h-screen flex flex-col bg-[#1E1E1E] text-[#CCCCCC]">
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

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#1E1E1E] transition-opacity duration-200 ease-out">
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

  if (!workspaceReady) {
    return <WorkspaceSelector currentWorkspace={null} onWorkspaceSelected={() => setWorkspaceReady(true)} />
  }

  return <AppShell />
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
