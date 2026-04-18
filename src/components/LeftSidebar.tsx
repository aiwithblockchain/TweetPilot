import { type ReactNode } from 'react'

export type SidebarView = 'workspace' | 'accounts' | 'data-blocks' | 'tasks' | 'settings'

interface SidebarItem {
  id: string
  label: string
  description: string
}

interface LeftSidebarProps {
  activeView: SidebarView
  width: number
  items: SidebarItem[]
  footer?: ReactNode
  onSelectItem: (itemId: string) => void
}

const VIEW_TITLES: Record<SidebarView, string> = {
  workspace: 'WORKSPACE',
  accounts: 'ACCOUNTS',
  'data-blocks': 'DATA BLOCKS',
  tasks: 'TASKS',
  settings: 'SETTINGS',
}

export function LeftSidebar({ activeView, width, items, footer, onSelectItem }: LeftSidebarProps) {
  return (
    <aside
      className="bg-[#252526] border-r border-[#2A2A2A] flex flex-col flex-shrink-0 min-w-0"
      style={{ width }}
    >
      <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A]">
        <div className="text-[11px] tracking-[0.08em] text-[#CCCCCC] font-semibold">
          {VIEW_TITLES[activeView]}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              className="w-full text-left px-2 py-2 rounded-sm hover:bg-[#2A2D2E] transition-colors"
            >
              <div className="text-sm text-[#CCCCCC] truncate">{item.label}</div>
              <div className="text-[11px] text-[#858585] truncate mt-0.5">{item.description}</div>
            </button>
          ))}
        </div>
      </div>

      {footer && <div className="border-t border-[#2A2A2A]">{footer}</div>}
    </aside>
  )
}
