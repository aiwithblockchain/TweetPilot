import type { WorkspaceFolderSummary } from '@/services/workspace/types'

interface DirectoryDetailPaneProps {
  summary: WorkspaceFolderSummary
}

export function DirectoryDetailPane({ summary }: DirectoryDetailPaneProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <div className="px-6 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-white">{summary.name}</h2>
        <div className="text-xs text-[var(--color-text-secondary)] mt-2">{summary.path}</div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="总项目数" value={summary.itemCount} />
          <StatCard label="文件夹" value={summary.folderCount} />
          <StatCard label="文件" value={summary.fileCount} />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className="text-2xl font-semibold text-white mt-2">{value}</div>
    </div>
  )
}
