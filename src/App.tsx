import { lazy } from 'react'
import { TitleBar } from './components/TitleBar'
import { ActivityBar } from './components/ActivityBar'
import { ResizableDivider } from './components/ResizableDivider'
import { LeftSidebar } from './components/LeftSidebar'
import { InstanceStatusPanel } from './components/InstanceStatusPanel'
import { RightPanel } from './components/RightPanel'
import { EditorTabsBar } from './components/EditorTabsBar'
import { CenterContentRouter } from './components/CenterContentRouter'
import { ToastProvider } from './contexts/ToastContext'
import { useAppLayoutState } from './hooks/useAppLayoutState'
import './styles/vscode-theme.css'

const TaskManagement = lazy(() => import('./pages/TaskManagement'))
const DataBlocks = lazy(() => import('./pages/DataBlocks'))
const SettingsPage = lazy(() => import('./pages/Settings'))

function App() {
  const {
    activeTab,
    activeView,
    currentSidebarItems,
    handleActivateTab,
    handleCloseTab,
    handleSelectSidebarItem,
    handleViewChange,
    instances,
    instancesError,
    isCompactLayout,
    leftWidth,
    mobileSidebarOpen,
    openTabs,
    persistLeftWidth,
    persistRightPanelVisible,
    persistRightWidth,
    rightPanelVisible,
    rightWidth,
    selectedSidebarItem,
    setMobileSidebarOpen,
  } = useAppLayoutState()

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-[#1E1E1E] text-[#CCCCCC]">
        <TitleBar />

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <ActivityBar activeView={activeView} onViewChange={handleViewChange} />

          <div className={isCompactLayout ? 'hidden md:flex' : 'flex'}>
            <LeftSidebar
              activeView={activeView}
              width={leftWidth}
              items={currentSidebarItems}
              footer={<InstanceStatusPanel instances={instances} errorMessage={instancesError} />}
              onSelectItem={handleSelectSidebarItem}
            />
            <ResizableDivider side="left" onResize={persistLeftWidth} isVisible={!isCompactLayout} />
          </div>

          <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#1E1E1E] transition-opacity duration-200 ease-out">
            <EditorTabsBar
              activeTab={activeTab}
              openTabs={openTabs}
              isCompactLayout={isCompactLayout}
              rightPanelVisible={rightPanelVisible}
              onActivateTab={handleActivateTab}
              onCloseTab={handleCloseTab}
              onToggleRightPanel={() => persistRightPanelVisible(!rightPanelVisible)}
              mobileSidebarTrigger={{
                activeView,
                items: currentSidebarItems,
                instances,
                instancesError,
                mobileSidebarOpen,
                onClose: () => setMobileSidebarOpen(false),
                onOpen: () => setMobileSidebarOpen(true),
                onSelectItem: handleSelectSidebarItem,
              }}
            />

            <div className="flex-1 min-h-0 overflow-auto">
              <CenterContentRouter
                activeTab={activeTab}
                selectedSidebarItem={selectedSidebarItem}
                instances={instances}
                instancesError={instancesError}
                TaskManagementPage={TaskManagement}
                DataBlocksPage={DataBlocks}
                SettingsPage={SettingsPage}
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
      </div>
    </ToastProvider>
  )
}

export default App
