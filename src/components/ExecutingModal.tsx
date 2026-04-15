interface ExecutingModalProps {
  taskName: string
}

export default function ExecutingModal({ taskName }: ExecutingModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] rounded-lg p-6 max-w-sm w-full mx-4 text-center">
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-[var(--color-border)] border-t-[#6D5BF6] rounded-full animate-spin mx-auto mb-4"></div>

        <h3 className="text-base font-semibold mb-2">正在执行任务</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">{taskName}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">请稍候...</p>
      </div>
    </div>
  )
}
