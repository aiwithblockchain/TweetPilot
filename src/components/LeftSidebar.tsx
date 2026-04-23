import { FolderPlus, FilePlus2, Plus, RefreshCw, ChevronRight, ChevronDown, File, Folder, Image as ImageIcon, FileCode2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { SidebarSectionAction, SidebarSectionConfig, View } from '@/config/layout'

export interface SidebarItem {
  id: string
  label: string
  description: string
  badge?: string
  badgeTone?: 'default' | 'success' | 'warning' | 'danger'
  group?: 'managed' | 'unmanaged'
}

export interface SidebarTreeItem {
  id: string
  label: string
  description: string
  depth: number
  kind: 'file' | 'directory'
  expanded?: boolean
  isBranch?: boolean
  icon?: 'file' | 'text' | 'image' | 'folder'
}

interface LeftSidebarProps {
  activeView: View
  width: number
  items: SidebarItem[]
  treeItems?: SidebarTreeItem[]
  section: SidebarSectionConfig
  footer?: ReactNode
  selectedItemId?: string | null
  onSelectItem: (itemId: string) => void
  onAction?: (actionId: string) => void
  onToggleTreeItem?: (itemId: string) => void
}

const ACTION_ICONS: Record<NonNullable<SidebarSectionAction['icon']>, typeof Plus> = {
  add: Plus,
  'add-file': FilePlus2,
  'add-folder': FolderPlus,
  refresh: RefreshCw,
}

const BADGE_TONES: Record<NonNullable<SidebarItem['badgeTone']>, string> = {
  default: 'text-[var(--color-text-secondary)] bg-[var(--color-bg)] border-[var(--color-border)]',
  success: 'text-[#4EC9B0] bg-[#4EC9B0]/10 border-[#4EC9B0]/30',
  warning: 'text-[#D7BA7D] bg-[#D7BA7D]/10 border-[#D7BA7D]/30',
  danger: 'text-[#F48771] bg-[#F48771]/10 border-[#F48771]/30',
}

const TREE_ICON_MAP = {
  file: File,
  text: FileCode2,
  image: ImageIcon,
  folder: Folder,
} as const

export function LeftSidebar({
  activeView,
  width,
  items,
  treeItems,
  section,
  footer,
  selectedItemId,
  onSelectItem,
  onAction,
  onToggleTreeItem,
}: LeftSidebarProps) {
  const shouldRenderTree = activeView === 'workspace' && treeItems
  const [collapsedGroups, setCollapsedGroups] = useState<Record<'managed' | 'unmanaged', boolean>>({
    managed: false,
    unmanaged: false,
  })

  return (
    <aside
      className="bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0 min-w-0"
      style={{ width }}
      data-view={activeView}
    >
      <div className="px-3 pt-3 pb-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] tracking-[0.08em] text-[var(--color-text)] font-semibold truncate">{section.title}</div>

          {section.actions && section.actions.length > 0 && (
            <div className="flex items-center gap-0.5">
              {section.actions.map((action) => {
                const Icon = action.icon ? ACTION_ICONS[action.icon] : Plus
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onAction?.(action.id)}
                    className="h-7 w-7 flex items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] transition-colors"
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

        <p className="text-[11px] text-[var(--color-text-secondary)] mt-2 leading-5 pr-1">{section.description}</p>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {shouldRenderTree ? (
          treeItems.length === 0 ? (
            <div className="px-2 py-3 text-xs text-[var(--color-text-secondary)] leading-5">{section.emptyMessage}</div>
          ) : (
            <div className="space-y-0.5">
              {treeItems.map((item) => {
                const isSelected = selectedItemId === item.id
                const Icon = TREE_ICON_MAP[item.icon ?? (item.kind === 'directory' ? 'folder' : 'file')]
                const ChevronIcon = item.expanded ? ChevronDown : ChevronRight

                return (
                  <div key={item.id} className="group">
                    <button
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      className={[
                        'w-full text-left rounded-md border transition-colors pr-2',
                        isSelected
                          ? 'border-[#094771] bg-[#062F4A] text-[#FFFFFF] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]'
                          : 'border-transparent text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] hover:border-[var(--color-border)]',
                      ].join(' ')}
                      style={{ paddingLeft: `${8 + item.depth * 14}px`, paddingTop: '6px', paddingBottom: '6px' }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          onClick={(event) => {
                            event.stopPropagation()
                            if (item.isBranch) {
                              onToggleTreeItem?.(item.id)
                            }
                          }}
                          className={[
                            'h-4 w-4 flex items-center justify-center rounded cursor-pointer',
                            item.isBranch ? 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)]' : 'text-transparent pointer-events-none',
                          ].join(' ')}
                          role="button"
                          tabIndex={-1}
                          aria-label={item.expanded ? '折叠文件夹' : '展开文件夹'}
                        >
                          <ChevronIcon className="w-3.5 h-3.5" />
                        </span>
                        <Icon className={[
                          'w-4 h-4 flex-shrink-0',
                          item.kind === 'directory' ? 'text-[#D7BA7D]' : item.icon === 'image' ? 'text-[#9CDCFE]' : 'text-[#4EC9B0]',
                        ].join(' ')} />
                        <span className="text-sm truncate">{item.label}</span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )
        ) : items.length === 0 ? (
          <div className="px-2 py-3 text-xs text-[var(--color-text-secondary)] leading-5">{section.emptyMessage}</div>
        ) : (
          <div className="space-y-3">
            {(['managed', 'unmanaged'] as const)
              .filter((group) => items.some((item) => (item.group ?? 'managed') === group))
              .map((group) => {
                const groupItems = items.filter((item) => (item.group ?? 'managed') === group)
                const groupLabel = group === 'managed' ? '当前已管理账号' : '未管理在线账号'

                return (
                  <div key={group} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                      className="w-full px-2.5 flex items-center justify-between text-[11px] font-semibold tracking-[0.06em] text-[var(--color-text-secondary)] cursor-pointer"
                    >
                      <span>{groupLabel}</span>
                      {collapsedGroups[group] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {!collapsedGroups[group] && (
                      <div className="space-y-0.5">
                        {groupItems.map((item) => {
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
                                  : 'border-transparent text-[var(--color-text)] hover:bg-[var(--vscode-hover-bg)] hover:border-[var(--color-border)]',
                              ].join(' ')}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm truncate">{item.label}</div>
                                  <div className={['text-[11px] truncate mt-0.5', isSelected ? 'text-[#9CDCFE]' : 'text-[var(--color-text-secondary)]'].join(' ')}>
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
                )
              })}
          </div>
        )}
      </div>

      {footer && <div className="border-t border-[var(--color-border)]">{footer}</div>}
    </aside>
  )
}
