import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { DataBlockCard } from '@/services/data-blocks'

interface AddCardDialogProps {
  onClose: () => void
  onAddCard: (cardType: string) => void
  existingCards: DataBlockCard[]
}

interface CardType {
  id: string
  name: string
  description: string
  requiresAccount: boolean
}

const CARD_TYPES: CardType[] = [
  {
    id: 'account_current_metrics',
    name: '账号实时数据',
    description: '显示账号的最新指标快照，包括粉丝、关注、推文等核心数据',
    requiresAccount: true,
  },
  {
    id: 'followers_growth_trend',
    name: '粉丝增长趋势',
    description: '显示过去 N 小时的粉丝增长曲线，直观展示账号增长情况',
    requiresAccount: true,
  },
  {
    id: 'account_activity_metrics',
    name: '账号活跃度',
    description: '显示推文数、点赞数、媒体数等活跃度指标的变化情况',
    requiresAccount: true,
  },
  {
    id: 'account_overview',
    name: '账号概览',
    description: '综合展示多个维度的数据对比，包括当前值和变化趋势',
    requiresAccount: true,
  },
]

export default function AddCardDialog({ onClose, onAddCard, existingCards }: AddCardDialogProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const existingCardTypes = new Set(existingCards.map((card) => card.type))
  const availableCardTypes = CARD_TYPES.filter((type) => !existingCardTypes.has(type.id))

  const handleAdd = () => {
    if (selectedType) {
      onAddCard(selectedType)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold">添加数据积木</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex cursor-pointer items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {availableCardTypes.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-sm text-secondary">所有积木类型都已添加</div>
            </div>
          ) : (
            <>
              <p className="text-sm text-secondary mb-3">选择要添加的积木类型：</p>
              <div className="grid gap-3">
                {availableCardTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-4 text-left border rounded-lg cursor-pointer transition-all ${
                      selectedType === type.id
                        ? 'border-[#6D5BF6] bg-[#6D5BF6]/5'
                        : 'border-[var(--color-border)] hover:border-[#6D5BF6] hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-semibold mb-1">{type.name}</div>
                        <div className="text-xs text-secondary">{type.description}</div>
                      </div>
                      {selectedType === type.id && (
                        <span className="text-[#6D5BF6] ml-2" aria-label="已选中">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded cursor-pointer hover:bg-[var(--color-surface)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedType || availableCardTypes.length === 0}
            className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded cursor-pointer hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  )
}
