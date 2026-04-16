import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onClose: (id: string) => void
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-500/10 border-green-500 text-green-500',
  error: 'bg-red-500/10 border-red-500 text-red-500',
  warning: 'bg-yellow-500/10 border-yellow-500 text-yellow-500',
  info: 'bg-blue-500/10 border-blue-500 text-blue-500',
}

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
}

export default function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  return (
    <div
      className={`flex items-center gap-3 min-w-[300px] max-w-[500px] p-4 rounded-lg border shadow-lg animate-slide-in ${typeStyles[type]}`}
    >
      <span className="text-lg font-semibold">{typeIcons[type]}</span>
      <span className="flex-1 text-sm">{message}</span>
      <button
        onClick={() => onClose(id)}
        className="w-6 h-6 flex items-center justify-center hover:bg-black/10 rounded transition-colors"
      >
        ×
      </button>
    </div>
  )
}
