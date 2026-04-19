import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import type { ExplorerNode } from '@/hooks/useExplorerState'

interface ExplorerTreeNodeProps {
  node: ExplorerNode
  level: number
  isExpanded: boolean
  isSelected: boolean
  onToggleExpand: (path: string) => void
  onSelect: (path: string) => void
}

export function ExplorerTreeNode({
  node,
  level,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
}: ExplorerTreeNodeProps) {
  const handleClick = () => {
    if (node.kind === 'directory') {
      onToggleExpand(node.path)
    }
    onSelect(node.path)
  }

  const handleArrowClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.kind === 'directory') {
      onToggleExpand(node.path)
    }
  }

  return (
    <div>
      <div
        className={[
          'flex items-center gap-1 px-2 py-1 cursor-pointer text-sm transition-colors',
          isSelected ? 'bg-[#37373D]' : 'hover:bg-[#2A2D2E]',
        ].join(' ')}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {node.kind === 'directory' ? (
          <button
            type="button"
            onClick={handleArrowClick}
            className="flex items-center justify-center w-4 h-4 hover:bg-[#3E3E42] rounded transition-colors"
          >
            <ChevronRight
              className={[
                'w-3 h-3 text-[#CCCCCC] transition-transform',
                isExpanded ? 'rotate-90' : '',
              ].join(' ')}
            />
          </button>
        ) : (
          <div className="w-4" />
        )}

        {node.kind === 'directory' ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-[#DCAA5F] flex-shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-[#DCAA5F] flex-shrink-0" />
          )
        ) : (
          <File className="w-4 h-4 text-[#CCCCCC] flex-shrink-0" />
        )}

        <span className="text-[#CCCCCC] truncate">{node.name}</span>
      </div>

      {node.kind === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <ExplorerTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              isExpanded={child.isExpanded ?? false}
              isSelected={isSelected}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
