import { useState } from 'react'
import Spinner from './Spinner'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] rounded-lg w-full max-w-md mx-4 shadow-xl">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold">{title}</h3>
        </div>

        <div className="p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="h-8 px-4 text-sm bg-transparent border border-[var(--color-border)] rounded hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`h-8 px-4 text-sm text-white rounded transition-colors disabled:opacity-50 flex items-center gap-2 ${
              danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[#6D5BF6] hover:bg-[#5B4AD4]'
            }`}
          >
            {loading && <Spinner size="sm" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
