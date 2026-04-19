import { FolderPlus, FilePlus2, Plus, RefreshCw, type ReactNode } from 'lucide-react'
import type { SidebarSectionAction, SidebarSectionConfig, View } from '@/config/layout'

interface SidebarItem {
  id: string
  label: string
  description: string
  badge?: string
  badgeTone?: 'default' | 'success' | 'warning' | 'danger'
}

interface LeftSidebarProps {
  activeView: View
  width: number
  items: SidebarItem[]
  section: SidebarSectionConfig
  footer?: ReactNode
  selectedItemId?: string | null
  onSelectItem: (itemId: string) => void
  onAction?: (actionId: string) => void
}

const ACTION_ICONS: Record<NonNullable<SidebarSectionAction['icon']>, typeof Plus> = {
  add: Plus,
  'add-file': FilePlus2,
  'add-folder': FolderPlus,
  refresh: RefreshCw,
}

const BADGE_TONES: Record<NonNullable<SidebarItem['badgeTone']>, string> = {
  default: 'text-[#858585] bg-[#1E1E1E] border-[#2A2A2A]',
  success: 'text-[#4EC9B0] bg-[#4EC9B0]/10 border-[#4EC9B0]/30',
  warning: 'text-[#D7BA7D] bg-[#D7BA7D]/10 border-[#D7BA7D]/30',
  danger: 'text-[#F48771] bg-[#F48771]/10 border-[#F48771]/30',
}

export function LeftSidebar({
  activeView,
  width,
  items,
  section,
  footer,
  selectedItemId,
  onSelectItem,
  onAction,
}: LeftSidebarProps) {
  return (
    <aside
      className="bg-[#252526] border-r border-[#2A2A2A] flex flex-col flex-shrink-0 min-w-0"
      style={{ width }}
      data-view={activeView}
    >
      <div className="px-3 pt-3 pb-2 border-b border-[#2A2A2A] bg-[#252526]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] tracking-[0.08em] text-[#CCCCCC] font-semibold truncate">{section.title}</div>

          {section.actions && section.actions.length > 0 && (
            <div className="flex items-center gap-0.5">
              {section.actions.map((action) => {
                const Icon = action.icon ? ACTION_ICONS[action.icon] : Plus
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onAction?.(action.id)}
                    className="h-7 w-7 flex items-center justify-center rounded text-[#858585] hover:bg-[#2A2A2A] hover:text-[#CCCCCC] transition-colors"
                    aria-label={action.label}
                    title={action.label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#858585] mt-2 leading-5 pr-1">{section.description}</p>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {items.length === 0 ? (
          <div className="px-2 py-3 text-xs text-[#858585] leading-5">{section.emptyMessage}</div>
        ) : (
          <div className="space-y-0.5">
            {items.map((item) => {
              const isSelected = selectedItemId === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  className={[
                    'w-full text-left px-2.5 py-2 rounded-md border transition-colors',
                    isSelected
                      ? 'border-[#094771] bg-[#062F4A] text-[#FFFFFF] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]'
                      : 'border-transparent text-[#CCCCCC] hover:bg-[#2A2D2E] hover:border-[#2A2A2A]',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm truncate">{item.label}</div>
                      <div className={['text-[11px] truncate mt-0.5', isSelected ? 'text-[#9CDCFE]' : 'text-[#858585]'].join(' ')}>
                        {item.description}
                      </div>
                    </div>
                    {item.badge && (
                      <span
                        className={[
                          'text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap mt-0.5',
                          BADGE_TONES[item.badgeTone ?? 'default'],
                        ].join(' ')}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {footer && <div className="border-t border-[#2A2A2A]">{footer}</div>}
    </aside>
  )
}
