import type { WorkspaceFileContent } from '@/services/workspace/types'

interface UnsupportedFilePaneProps {
  content: WorkspaceFileContent
}

export function UnsupportedFilePane({ content }: UnsupportedFilePaneProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      <div className="px-6 py-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-white">{content.name}</h2>
        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
          <span>{content.path}</span>
          {content.size !== null && content.size !== undefined && <span>{formatFileSize(content.size)}</span>}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-sm text-[var(--color-text-secondary)] mb-2">暂不支持预览此文件类型</div>
          {content.extension && (
            <div className="text-xs text-[#6A6A6A]">文件扩展名: {content.extension}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
