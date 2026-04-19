import { Menu, X } from 'lucide-react'
import { LeftSidebar } from './LeftSidebar'
import type { SidebarItem, SidebarSectionConfig, View } from '@/config/layout'

interface MobileSidebarDrawerProps {
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

export function MobileSidebarDrawer({
  activeView,
  items,
  section,
  selectedItemId,
  mobileSidebarOpen,
  onAction,
  onClose,
  onOpen,
  onSelectItem,
}: MobileSidebarDrawerProps) {
  return (
    <>
      <button
        onClick={onOpen}
        className="h-7 w-7 flex items-center justify-center rounded text-[#CCCCCC] hover:bg-[#2A2A2A] transition-all duration-150 flex-shrink-0"
        aria-label="打开侧边栏"
      >
        <Menu className="w-4 h-4" />
      </button>

      <div
        className={[
          'fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-200',
          mobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={[
          'fixed inset-y-8 left-12 z-50 w-[280px] max-w-[calc(100vw-3rem)] bg-[#252526] border-r border-[#2A2A2A] shadow-2xl md:hidden flex flex-col transition-transform duration-200 ease-out',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+3rem)] pointer-events-none',
        ].join(' ')}
      >
        <div className="h-9 px-3 border-b border-[#2A2A2A] flex items-center justify-between bg-[#2D2D2D]">
          <span className="text-xs font-semibold text-[#CCCCCC]">侧边栏</span>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded text-[#CCCCCC] hover:bg-[#3C3C3C] transition-colors"
            aria-label="关闭侧边栏"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <LeftSidebar
          activeView={activeView}
          width={280}
          items={items}
          section={section}
          selectedItemId={selectedItemId}
          onAction={onAction}
          onSelectItem={onSelectItem}
        />
      </div>
    </>
  )
}
