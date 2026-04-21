import { X } from 'lucide-react'
import SettingsPage from '@/pages/Settings'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-6 py-8">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div className="relative z-[81] w-full max-w-5xl h-[720px] max-h-[calc(100vh-4rem)] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl flex flex-col">
        <div className="h-11 px-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between gap-3 flex-shrink-0">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">设置</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">全局配置以对话框形式打开，不打断当前工作流。</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
            aria-label="关闭设置"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <SettingsPage />
        </div>
      </div>
    </div>
  )
}
