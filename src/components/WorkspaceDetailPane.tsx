import { formatDistanceToNow } from 'date-fns'
import { FileText, FolderClosed, Image as ImageIcon, FileQuestion, Loader2 } from 'lucide-react'
import type { SidebarItem } from '@/config/layout'
import type { WorkspaceFileContent, WorkspaceFolderSummary } from '@/services/workspace'

interface WorkspaceDetailPaneProps {
  item: SidebarItem | null
  fileContent?: WorkspaceFileContent | null
  folderSummary?: WorkspaceFolderSummary | null
  loading?: boolean
  error?: string | null
}

export function WorkspaceDetailPane({ item, fileContent, folderSummary, loading, error }: WorkspaceDetailPaneProps) {
  if (!item) {
    return <EmptyState title="工作区" description="请先在左侧目录树中选择一个文件或文件夹，再在中间查看内容。" />
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="rounded border border-[#2A2A2A] bg-[#252526] px-6 py-8 text-center">
          <Loader2 className="w-5 h-5 text-[#9CDCFE] animate-spin mx-auto" />
          <p className="text-sm text-[#858585] mt-3">正在加载 {item.label} ...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return <EmptyState title={item.label} description={error} />
  }

  if (folderSummary) {
    return (
      <div className="p-6 space-y-5">
        <Header title={folderSummary.name} subtitle={item.description} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard label="总项目数" value={String(folderSummary.itemCount)} hint="当前文件夹直系子项" />
          <MetricCard label="文件夹" value={String(folderSummary.folderCount)} hint="可继续展开浏览" />
          <MetricCard label="文件" value={String(folderSummary.fileCount)} hint="点击后在此处预览" />
        </div>

        <Panel icon={<FolderClosed className="w-5 h-5 text-[#D7BA7D]" />} title="目录概览">
          <div className="text-sm text-[#CCCCCC] leading-6 space-y-2">
            <p>当前选中的是文件夹节点。v1 支持在左侧展开子目录、刷新目录，以及在当前目录下新建文件或文件夹。</p>
            <p className="text-[#858585] break-all">路径：{folderSummary.path}</p>
          </div>
        </Panel>
      </div>
    )
  }

  if (!fileContent) {
    return <EmptyState title={item.label} description="当前节点暂无可展示内容。" />
  }

  return (
    <div className="p-6 space-y-5">
      <Header
        title={fileContent.name}
        subtitle={[
          item.description,
          fileContent.modifiedAt ? `更新于 ${formatTimestamp(fileContent.modifiedAt)}` : null,
          fileContent.size != null ? `${formatSize(fileContent.size)}` : null,
        ].filter(Boolean).join(' · ')}
      />

      {fileContent.contentType === 'text' && (
        <Panel icon={<FileText className="w-5 h-5 text-[#4EC9B0]" />} title="文本预览">
          <pre className="rounded border border-[#2A2A2A] bg-[#1E1E1E] p-4 text-xs text-[#CCCCCC] leading-6 overflow-auto whitespace-pre-wrap min-h-[260px]">
            {fileContent.textContent ?? ''}
          </pre>
        </Panel>
      )}

      {fileContent.contentType === 'image' && (
        <Panel icon={<ImageIcon className="w-5 h-5 text-[#9CDCFE]" />} title="图片预览">
          <div className="rounded border border-[#2A2A2A] bg-[#1E1E1E] p-4 min-h-[280px] flex items-center justify-center overflow-auto">
            {fileContent.imageSrc ? (
              <img src={fileContent.imageSrc} alt={fileContent.name} className="max-w-full max-h-[560px] object-contain" />
            ) : (
              <div className="text-sm text-[#858585]">图片数据不可用</div>
            )}
          </div>
        </Panel>
      )}

      {fileContent.contentType === 'unsupported' && (
        <Panel icon={<FileQuestion className="w-5 h-5 text-[#D7BA7D]" />} title="暂不支持的文件类型">
          <div className="rounded border border-dashed border-[#2A2A2A] bg-[#1E1E1E] min-h-[220px] flex flex-col items-center justify-center text-sm text-[#858585] text-center px-6">
            <div>TODO: v1 暂不支持预览该文件类型。</div>
            <div className="mt-2 break-all text-xs">路径：{fileContent.path}</div>
          </div>
        </Panel>
      )}
    </div>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[#CCCCCC]">{title}</h2>
      <p className="text-sm text-[#858585] mt-1 leading-6">{subtitle}</p>
    </div>
  )
}

function Panel({ icon, title, children }: { icon: JSX.Element; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[#2A2A2A] bg-[#252526] p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <div className="text-sm font-semibold text-[#CCCCCC]">{title}</div>
      </div>
      {children}
    </section>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded border border-[#2A2A2A] bg-[#252526] p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-[#858585]">{label}</div>
      <div className="text-lg font-semibold text-[#CCCCCC] mt-2">{value}</div>
      <div className="text-xs text-[#858585] mt-2 leading-5">{hint}</div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="max-w-md text-center rounded border border-[#2A2A2A] bg-[#252526] px-6 py-8">
        <div className="text-base font-semibold text-[#CCCCCC]">{title}</div>
        <p className="text-sm text-[#858585] mt-3 leading-6">{description}</p>
      </div>
    </div>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return `${date.toLocaleString('zh-CN')} (${formatDistanceToNow(date, { addSuffix: true })})`
}
