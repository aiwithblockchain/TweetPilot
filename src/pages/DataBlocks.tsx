import { useState, useEffect } from 'react'
import SortableDataCard from '../components/SortableDataCard'
import AddCardDialog from '../components/AddCardDialog'
import { accountService, dataBlocksService } from '@/services'
import type { MappedAccount } from '@/services/account'
import type { DataBlockCard } from '@/services/data-blocks'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'

export type Card = DataBlockCard

export default function DataBlocks() {
  const [cards, setCards] = useState<DataBlockCard[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<MappedAccount[]>([])
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    void loadData()
  }, [])

  const loadData = async () => {
    try {
      const accountsResult = await accountService.getMappedAccounts()
      setAccounts(accountsResult)

      if (accountsResult.length > 0 && !selectedAccount) {
        setSelectedAccount(accountsResult[0].screenName)
      }

      const layout = await dataBlocksService.getLayout()
      setCards(layout)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCard = async (cardType: string) => {
    try {
      const newCard = await dataBlocksService.addCard(cardType, {})
      setCards((prev) => [...prev, newCard])
      setShowAddDialog(false)
    } catch (error) {
      console.error('Failed to add card:', error)
      alert('添加卡片失败: ' + (error as Error).message)
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('确定要删除这个卡片吗？')) {
      return
    }

    try {
      await dataBlocksService.deleteCard(cardId)
      setCards((prev) => prev.filter((card) => card.id !== cardId))
    } catch (error) {
      console.error('Failed to delete card:', error)
      alert('删除失败: ' + (error as Error).message)
    }
  }

  const handleRefreshCard = async (cardId: string) => {
    try {
      await dataBlocksService.refreshCardData(cardId)
      setCards((prev) =>
        prev.map((card) =>
          card.id === cardId ? { ...card, lastUpdated: new Date().toISOString() } : card
        )
      )
    } catch (error) {
      console.error('Failed to refresh card:', error)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = cards.findIndex((item) => item.id === active.id)
    const newIndex = cards.findIndex((item) => item.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    const reordered = arrayMove(cards, oldIndex, newIndex).map((item, index) => ({
      ...item,
      position: index,
    }))

    setCards(reordered)

    try {
      await dataBlocksService.saveLayout(reordered)
    } catch (error) {
      console.error('Failed to save layout:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-secondary">加载中...</div>
      </div>
    )
  }

  const selectedAccountData = accounts.find((account) => account.screenName === selectedAccount)

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold">数据积木</h2>
        <div className="flex items-center gap-3">
          {accounts.length > 0 && selectedAccountData && (
            <div className="relative">
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="flex items-center gap-2 h-8 px-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg)] transition-colors"
              >
                <img
                  src={selectedAccountData.avatar}
                  alt={selectedAccountData.displayName}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-sm">{selectedAccountData.displayName}</span>
                <span className="text-xs">▼</span>
              </button>

              {showAccountDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded shadow-lg min-w-[200px] z-50">
                  {accounts.map((account) => (
                    <button
                      key={account.screenName}
                      onClick={() => {
                        setSelectedAccount(account.screenName)
                        setShowAccountDropdown(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface)] transition-colors ${
                        account.screenName === selectedAccount ? 'bg-[var(--color-surface)]' : ''
                      }`}
                    >
                      <img
                        src={account.avatar}
                        alt={account.displayName}
                        className="w-6 h-6 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{account.displayName}</div>
                        <div className="text-xs text-secondary">{account.screenName}</div>
                      </div>
                      {account.screenName === selectedAccount && (
                        <span className="text-[#6D5BF6]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowAddDialog(true)}
            className="h-8 px-3 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
          >
            添加卡片
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-base font-medium mb-1">暂无数据卡片</div>
            <div className="text-xs text-secondary">点击"添加卡片"按钮添加第一个数据卡片</div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={cards.map((card) => card.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-4">
                {cards.map((card) => (
                  <SortableDataCard
                    key={card.id}
                    card={card}
                    selectedAccount={selectedAccount}
                    onRefresh={() => handleRefreshCard(card.id)}
                    onDelete={() => handleDeleteCard(card.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {showAddDialog && (
        <AddCardDialog
          onClose={() => setShowAddDialog(false)}
          onAddCard={handleAddCard}
          existingCards={cards}
        />
      )}
    </div>
  )
}
