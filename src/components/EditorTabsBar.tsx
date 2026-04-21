import { ChevronLeft, ChevronRight, PanelsTopLeft } from 'lucide-react'
import { MobileSidebarDrawer } from './MobileSidebarDrawer'
import { type OpenTab, type SidebarItem, type SidebarSectionConfig, type TabId, type View } from '@/config/layout'

interface MobileSidebarTriggerProps {
  activeView: View
  items: SidebarItem[]
  section: SidebarSectionConfig
  selectedItemId?: string | null
  mobileSidebarOpen: boolean
  onAction?: (actionId: string) => void
  onClose: () => void
  onOpen: () => void
  onSelectItem: (itemId: string) => void
}

interface EditorTabsBarProps {
  activeTab: TabId
  openTabs: OpenTab[]
  isCompactLayout: boolean
  rightPanelVisible: boolean
  onActivateTab: (tabId: TabId) => void
  onCloseTab: (tabId: TabId) => void
  onToggleRightPanel: () => void
  mobileSidebarTrigger?: MobileSidebarTriggerProps
}

export function EditorTabsBar({
  activeTab,
  openTabs,
  isCompactLayout,
  rightPanelVisible,
  onActivateTab,
  onCloseTab,
  onToggleRightPanel,
  mobileSidebarTrigger,
}: EditorTabsBarProps) {
  return (
    <div className="h-9 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between px-2 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {isCompactLayout && mobileSidebarTrigger && <MobileSidebarDrawer {...mobileSidebarTrigger} />}

        <div className="flex items-center overflow-x-auto min-w-0">
          {openTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isClosable = tab.id !== 'workspace' || openTabs.length > 1

            return (
              <button
                key={tab.id}
                onClick={() => onActivateTab(tab.id)}
                className={[
                  'group h-9 min-w-[140px] max-w-[220px] px-3 flex items-center gap-2 border-r border-[var(--color-border)] transition-all duration-150 text-xs',
                  isActive ? 'bg-[var(--color-bg)] text-[var(--color-text)]' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
                ].join(' ')}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1 text-left">{tab.title}</span>
                {isClosable && (
                  <span
                    onClick={(event) => {
                      event.stopPropagation()
                      onCloseTab(tab.id)
                    }}
                    className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--vscode-hover-bg)]"
                    role="button"
                    aria-label={`关闭 ${tab.title}`}
                  >
                    ×
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={onToggleRightPanel}
        className="h-7 px-2 text-xs text-[var(--color-text)] hover:bg-[var(--color-border)] rounded flex items-center gap-1 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={rightPanelVisible ? '隐藏 Claude 面板' : '显示 Claude 面板'}
        disabled={isCompactLayout}
      >
        {rightPanelVisible ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        <PanelsTopLeft className="w-4 h-4" />
        Claude
      </button>
    </div>
  )
}
