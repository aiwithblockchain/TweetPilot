import { Image as ImageIcon, FileText, FolderClosed } from 'lucide-react'
import type { SidebarItem } from '@/config/layout'

interface WorkspaceDetailPaneProps {
  item: SidebarItem | null
}

const WORKSPACE_DETAILS: Record<string, { type: 'folder' | 'text' | 'image'; title: string; description: string; preview?: string }> = {
  'workspace-root': {
    type: 'folder',
    title: 'TweetPilot 工作区',
    description: '这是当前工作区根目录。后续这里会显示真实目录树的摘要、文件计数和最近更新时间。',
  },
  'workspace-docs': {
    type: 'text',
    title: 'docs',
    description: '当前选中的是文档目录。后续点击具体 txt 文本文件时，会在这里展示实际文本内容预览。',
    preview: ['# VSCode UI 重构', '', '1. 左侧菜单只切换工作域', '2. 左侧列表决定中间详情', '3. 设置改为底部独立 dialog'].join('\n'),
  },
  'workspace-assets': {
    type: 'image',
    title: 'assets',
    description: '当前选中的是资源目录。后续点击图片文件时，会在这里显示图片预览。',
  },
}

export function WorkspaceDetailPane({ item }: WorkspaceDetailPaneProps) {
  if (!item) {
    return <EmptyState title="工作区" description="请先在左侧目录树中选择一个文件或文件夹，再在中间查看内容。" />
  }

  const detail = WORKSPACE_DETAILS[item.id] ?? {
    type: 'text' as const,
    title: item.label,
    description: item.description,
    preview: '该项目的真实文件预览能力将在下一阶段接入。',
  }

  return (
    <div className="p-6 space-y-5">
      <Header title={detail.title} subtitle={detail.description} />

      {detail.type === 'folder' && (
        <Panel icon={<FolderClosed className="w-5 h-5 text-[#D7BA7D]" />} title="目录概览">
          <p className="text-sm text-[#CCCCCC] leading-6">当前目录作为容器节点存在。下一阶段会接入真实目录树、新建文件、新建文件夹和刷新能力。</p>
        </Panel>
      )}

      {detail.type === 'text' && (
        <Panel icon={<FileText className="w-5 h-5 text-[#4EC9B0]" />} title="文本预览">
          <pre className="rounded border border-[#2A2A2A] bg-[#1E1E1E] p-4 text-xs text-[#CCCCCC] leading-6 overflow-auto whitespace-pre-wrap">
            {detail.preview}
          </pre>
        </Panel>
      )}

      {detail.type === 'image' && (
        <Panel icon={<ImageIcon className="w-5 h-5 text-[#9CDCFE]" />} title="图片预览占位">
          <div className="rounded border border-dashed border-[#2A2A2A] bg-[#1E1E1E] min-h-[220px] flex items-center justify-center text-sm text-[#858585]">
            这里会显示图片文件预览
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
