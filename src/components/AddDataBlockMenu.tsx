import { BarChart3, Plus, Sparkles, Workflow } from 'lucide-react'
import { DATA_BLOCK_CATALOG } from '@/config/data-blocks'
import type { KnownDataBlockCardType } from '@/services/data-blocks'

interface AddDataBlockMenuProps {
  open: boolean
  anchorTop?: number
  anchorLeft?: number
  onClose: () => void
  onSelect: (cardType: KnownDataBlockCardType) => void
}

export function AddDataBlockMenu({ open, anchorTop = 76, anchorLeft = 176, onClose, onSelect }: AddDataBlockMenuProps) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed z-[71] w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        style={{ top: anchorTop, left: anchorLeft }}
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] bg-[linear-gradient(135deg,#6D5BF622_0%,#252526_55%,#1E1E1E_100%)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <Sparkles className="w-4 h-4 text-[#D7BA7D]" />
            选择要添加的数据积木
          </div>
          <div className="text-[11px] text-[#A0A0A0] mt-2 leading-5">
            这里不只是“加一个卡片”，而是在左侧工作流里新增一个可深入查看的数据积木。
          </div>
        </div>

        <div className="max-h-[520px] overflow-auto p-3">
          <div className="space-y-2">
            {DATA_BLOCK_CATALOG.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className="w-full text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-input)] hover:bg-[var(--color-surface)] hover:border-[var(--color-border)] transition-all px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5"
                    style={{ backgroundColor: `${item.accent}22`, color: item.accent }}
                  >
                    {item.category === 'analytics' ? <BarChart3 className="w-5 h-5" /> : item.category === 'tasks' ? <Workflow className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[#E5E5E5]">{item.name}</div>
                      <div className="text-[11px] px-2 py-1 rounded-full bg-black/20" style={{ color: item.accent }}>
                        {item.summary}
                      </div>
                    </div>
                    <div className="text-[12px] text-[#9A9A9A] mt-2 leading-6">{item.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
