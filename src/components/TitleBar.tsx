import { useState, useEffect, type MouseEvent } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Sidebar, PanelLeftClose, PanelRightClose, Minus, Copy, Square, X } from 'lucide-react'

interface TitleBarProps {
  leftSidebarVisible: boolean
  rightPanelVisible: boolean
  onToggleLeftSidebar: () => void
  onToggleRightPanel: () => void
}

export function TitleBar({
  leftSidebarVisible,
  rightPanelVisible,
  onToggleLeftSidebar,
  onToggleRightPanel,
}: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = async () => {
      const appWindow = getCurrentWindow()
      const maximized = await appWindow.isMaximized()
      setIsMaximized(maximized)
    }

    checkMaximized()

    const unlisten = getCurrentWindow().onResized(() => {
      checkMaximized()
    })

    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  const handleMinimize = async () => {
    await getCurrentWindow().minimize()
  }

  const handleMaximize = async () => {
    const appWindow = getCurrentWindow()
    if (isMaximized) {
      await appWindow.unmaximize()
    } else {
      await appWindow.toggleMaximize()
    }
    const nextMaximized = await appWindow.isMaximized()
    setIsMaximized(nextMaximized)
  }

  const handleClose = async () => {
    await getCurrentWindow().close()
  }

  const stopWindowDrag = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDragMouseDown = async (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('button')) return

    try {
      await getCurrentWindow().startDragging()
    } catch (error) {
      console.error('startDragging failed', error)
    }
  }

  const handleDragDoubleClick = async () => {
    try {
      await handleMaximize()
    } catch (error) {
      console.error('toggleMaximize failed', error)
    }
  }

  return (
    <div className="h-9 bg-[#323233] flex items-center select-none border-b border-[#2A2A2A]">
      <div
        onMouseDown={handleDragMouseDown}
        onDoubleClick={handleDragDoubleClick}
        className="flex items-center gap-2 flex-1 h-full min-w-0 pl-3 pr-2 cursor-move"
      >
        <span className="text-[#CCCCCC] text-sm font-medium truncate">TweetPilot</span>
      </div>

      <div className="flex items-center gap-1 px-2 h-full">
        <button
          type="button"
          onMouseDown={stopWindowDrag}
          onClick={onToggleLeftSidebar}
          className={[
            'w-7 h-7 rounded flex items-center justify-center transition-colors',
            leftSidebarVisible ? 'bg-[#2A2A2A] text-[#CCCCCC]' : 'text-[#858585] hover:bg-[#2A2A2A] hover:text-[#CCCCCC]',
          ].join(' ')}
          aria-label={leftSidebarVisible ? '隐藏左侧栏' : '显示左侧栏'}
          title={leftSidebarVisible ? '隐藏左侧栏' : '显示左侧栏'}
        >
          {leftSidebarVisible ? <PanelLeftClose className="w-4 h-4" /> : <Sidebar className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onMouseDown={stopWindowDrag}
          onClick={onToggleRightPanel}
          className={[
            'w-7 h-7 rounded flex items-center justify-center transition-colors',
            rightPanelVisible ? 'bg-[#2A2A2A] text-[#CCCCCC]' : 'text-[#858585] hover:bg-[#2A2A2A] hover:text-[#CCCCCC]',
          ].join(' ')}
          aria-label={rightPanelVisible ? '隐藏右侧栏' : '显示右侧栏'}
          title={rightPanelVisible ? '隐藏右侧栏' : '显示右侧栏'}
        >
          {rightPanelVisible ? <PanelRightClose className="w-4 h-4" /> : <Sidebar className="w-4 h-4 scale-x-[-1]" />}
        </button>
      </div>

      <div className="flex items-center h-full">
        <button
          type="button"
          onMouseDown={stopWindowDrag}
          onClick={handleMinimize}
          className="w-10 h-9 flex items-center justify-center hover:bg-[#2A2A2A] transition-colors"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4 text-[#CCCCCC]" />
        </button>
        <button
          type="button"
          onMouseDown={stopWindowDrag}
          onClick={handleMaximize}
          className="w-10 h-9 flex items-center justify-center hover:bg-[#2A2A2A] transition-colors"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy className="w-3.5 h-3.5 text-[#CCCCCC]" /> : <Square className="w-3.5 h-3.5 text-[#CCCCCC]" />}
        </button>
        <button
          type="button"
          onMouseDown={stopWindowDrag}
          onClick={handleClose}
          className="w-10 h-9 flex items-center justify-center hover:bg-[#F48771] transition-colors group"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-[#CCCCCC] group-hover:text-white" />
        </button>
      </div>
    </div>
  )
}
