import { useState } from 'react'
import { CardType } from '../pages/DataBlocks'

interface AddCardDialogProps {
  onClose: () => void
  onAddCard: (cardType: string) => void
}

const CARD_TYPES: CardType[] = [
  {
    id: 'latest_tweets',
    name: '最新推文列表',
    description: '显示账号最新的 10 条推文',
    requiresAccount: true,
  },
  {
    id: 'account_basic_data',
    name: '粉丝统计',
    description: '显示关注数、被关注数等基础信息',
    requiresAccount: true,
  },
  {
    id: 'account_interaction_data',
    name: '推文互动数据',
    description: '显示总浏览量、点赞数、转推数',
    requiresAccount: true,
  },
  {
    id: 'tweet_time_distribution',
    name: '推文时间分布',
    description: '显示最近 7 天的推文发布数量',
    requiresAccount: true,
  },
  {
    id: 'task_execution_stats',
    name: '任务执行统计',
    description: '显示最近 24 小时的任务执行情况',
    requiresAccount: false,
  },
]

export default function AddCardDialog({ onClose, onAddCard }: AddCardDialogProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const handleAdd = () => {
    if (selectedType) {
      onAddCard(selectedType)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold">添加数据卡片</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <p className="text-sm text-secondary mb-3">选择要添加的卡片类型：</p>
          <div className="grid gap-3">
            {CARD_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`p-4 text-left border rounded-lg transition-all ${
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
                    <span className="text-[#6D5BF6] ml-2">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="h-8 px-3 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedType}
            className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  )
}
