import { useState, useEffect } from 'react'
import SortableDataCard from '../components/SortableDataCard'
import AddCardDialog from '../components/AddCardDialog'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { dataBlocksService } from '@/services'
import { useToast } from '@/contexts/ToastContext'
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
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null)
  const toast = useToast()

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
      toast.success('卡片添加成功')
    } catch (error) {
      console.error('Failed to add card:', error)
      toast.error('添加卡片失败: ' + (error as Error).message)
    }
  }

  const handleDeleteCard = (cardId: string) => {
    setDeleteCardId(cardId)
  }

  const confirmDeleteCard = async () => {
    if (!deleteCardId) return

    try {
      await dataBlocksService.deleteCard(deleteCardId)
      const layout = await dataBlocksService.getLayout()
      setCards(layout)
      toast.success('卡片删除成功')
    } catch (error) {
      console.error('Failed to delete card:', error)
      toast.error('删除失败: ' + (error as Error).message)
    } finally {
      setDeleteCardId(null)
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
      const layout = await dataBlocksService.getLayout()
      setCards(layout)
    } catch (error) {
      console.error('Failed to save layout:', error)
      await loadData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-secondary">加载中...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold">数据积木</h2>
        <div className="flex items-center gap-3">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card) => (
                  <SortableDataCard
                    key={card.id}
                    card={card}
                    selectedAccount={null}
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

      <ConfirmDialog
        open={deleteCardId !== null}
        title="删除卡片"
        message="确定要删除这个卡片吗？此操作无法撤销。"
        confirmText="删除"
        cancelText="取消"
        danger={true}
        onConfirm={confirmDeleteCard}
        onCancel={() => setDeleteCardId(null)}
      />
    </div>
  )
}
