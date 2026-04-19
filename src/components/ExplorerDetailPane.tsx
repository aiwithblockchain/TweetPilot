import { TextFilePreview } from './TextFilePreview'
import { ImageFilePreview } from './ImageFilePreview'
import { DirectoryDetailPane } from './DirectoryDetailPane'
import { UnsupportedFilePane } from './UnsupportedFilePane'
import type { ExplorerDetail } from '@/hooks/useExplorerState'

interface ExplorerDetailPaneProps {
  detail: ExplorerDetail
  loading: boolean
  error: string | null
}

export function ExplorerDetailPane({ detail, loading, error }: ExplorerDetailPaneProps) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1E1E1E]">
        <div className="text-sm text-[#858585]">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1E1E1E]">
        <div className="text-sm text-[#F48771]">{error}</div>
      </div>
    )
  }

  if (detail.type === 'empty') {
    return (
      <div className="h-full flex items-center justify-center bg-[#1E1E1E]">
        <div className="text-sm text-[#858585]">请从左侧选择文件或文件夹</div>
      </div>
    )
  }

  if (detail.type === 'directory') {
    return <DirectoryDetailPane summary={detail.data} />
  }

  if (detail.type === 'file') {
    const { contentType } = detail.data

    if (contentType === 'text') {
      return <TextFilePreview content={detail.data} />
    }

    if (contentType === 'image') {
      return <ImageFilePreview content={detail.data} />
    }

    return <UnsupportedFilePane content={detail.data} />
  }

  return (
    <div className="h-full flex items-center justify-center bg-[#1E1E1E]">
      <div className="text-sm text-[#858585]">未知内容类型</div>
    </div>
  )
}
