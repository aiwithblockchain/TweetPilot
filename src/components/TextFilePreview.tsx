import type { WorkspaceFileContent } from '@/services/workspace/types'

interface TextFilePreviewProps {
  content: WorkspaceFileContent
}

export function TextFilePreview({ content }: TextFilePreviewProps) {
  return (
    <div className="h-full flex flex-col bg-[#1E1E1E]">
      <div className="px-6 py-4 border-b border-[#2A2A2A]">
        <h2 className="text-lg font-semibold text-white">{content.name}</h2>
        <div className="flex items-center gap-4 mt-2 text-xs text-[#858585]">
          <span>{content.path}</span>
          {content.size !== null && <span>{formatFileSize(content.size)}</span>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <pre className="text-sm text-[#CCCCCC] font-mono leading-6 whitespace-pre-wrap break-words">
          {content.textContent}
        </pre>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
