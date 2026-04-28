import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DataCard from './DataCard'
import type { DataBlockCard } from '@/services/data-blocks'

interface SortableDataCardProps {
  card: DataBlockCard
  selectedAccount: string | null
  onRefresh: () => void
  onDelete: () => void
}

export default function SortableDataCard({ card, selectedAccount, onRefresh, onDelete }: SortableDataCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="relative">
        <div
          {...listeners}
          className="absolute top-3 right-12 w-6 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-[var(--color-bg)] rounded transition-colors z-10"
          title="拖拽排序"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="5" cy="4" r="1" fill="currentColor" />
            <circle cx="11" cy="4" r="1" fill="currentColor" />
            <circle cx="5" cy="8" r="1" fill="currentColor" />
            <circle cx="11" cy="8" r="1" fill="currentColor" />
            <circle cx="5" cy="12" r="1" fill="currentColor" />
            <circle cx="11" cy="12" r="1" fill="currentColor" />
          </svg>
        </div>
        <DataCard
          card={card}
          selectedAccount={selectedAccount}
          onRefresh={onRefresh}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}
