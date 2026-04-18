import { ChatInterface } from './ChatInterface'

interface RightPanelProps {
  width: number
  onToggle: () => void
}

export function RightPanel({ width, onToggle }: RightPanelProps) {
  return (
    <aside
      className="bg-[#252526] border-l border-[#2A2A2A] flex flex-col flex-shrink-0 min-w-0"
      style={{ width }}
    >
      <div className="h-9 border-b border-[#2A2A2A] px-3 flex items-center justify-between">
        <div className="text-xs font-semibold text-[#CCCCCC] tracking-[0.04em]">💬 Claude Code</div>
        <button
          onClick={onToggle}
          className="text-xs text-[#858585] hover:text-[#CCCCCC] transition-colors"
          aria-label="折叠 Claude 面板"
        >
          隐藏
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <ChatInterface />
      </div>
    </aside>
  )
}
