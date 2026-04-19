import { FilePlus, FolderPlus, RefreshCw } from 'lucide-react'
import { ExplorerTreeNode } from './ExplorerTreeNode'
import type { ExplorerNode } from '@/hooks/useExplorerState'

interface ExplorerSidebarProps {
  treeData: ExplorerNode[]
  expandedPaths: Set<string>
  selectedPath: string | null
  loading: boolean
  error: string | null
  onToggleExpand: (path: string) => void
  onSelectNode: (path: string) => void
  onRefresh: () => void
  onCreateFile?: () => void
  onCreateFolder?: () => void
}

export function ExplorerSidebar({
  treeData,
  expandedPaths,
  selectedPath,
  loading,
  error,
  onToggleExpand,
  onSelectNode,
  onRefresh,
  onCreateFile,
  onCreateFolder,
}: ExplorerSidebarProps) {
  return (
    <div className="h-full flex flex-col bg-[#252526]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2A2A2A]">
        <span className="text-xs font-semibold text-[#CCCCCC] uppercase">工作区</span>
        <div className="flex items-center gap-1">
          {onCreateFile && (
            <button
              type="button"
              onClick={onCreateFile}
              className="p-1 hover:bg-[#2A2D2E] rounded transition-colors"
              title="新建文件"
            >
              <FilePlus className="w-4 h-4 text-[#CCCCCC]" />
            </button>
          )}
          {onCreateFolder && (
            <button
              type="button"
              onClick={onCreateFolder}
              className="p-1 hover:bg-[#2A2D2E] rounded transition-colors"
              title="新建文件夹"
            >
              <FolderPlus className="w-4 h-4 text-[#CCCCCC]" />
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1 hover:bg-[#2A2D2E] rounded transition-colors disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={['w-4 h-4 text-[#CCCCCC]', loading ? 'animate-spin' : ''].join(' ')} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="px-3 py-2 text-xs text-[#F48771]">{error}</div>
        )}

        {!error && treeData.length === 0 && !loading && (
          <div className="px-3 py-2 text-xs text-[#858585]">当前目录为空</div>
        )}

        {treeData.map((node) => (
          <ExplorerTreeNode
            key={node.path}
            node={node}
            level={0}
            isExpanded={expandedPaths.has(node.path)}
            isSelected={selectedPath === node.path}
            onToggleExpand={onToggleExpand}
            onSelect={onSelectNode}
          />
        ))}
      </div>
    </div>
  )
}
