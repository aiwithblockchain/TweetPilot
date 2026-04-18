import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Square, X } from 'lucide-react'

export function TitleBar() {
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
      await appWindow.maximize()
    }
    setIsMaximized(!isMaximized)
  }

  const handleClose = async () => {
    await getCurrentWindow().close()
  }

  return (
    <div
      data-tauri-drag-region
      className="h-8 bg-[#323233] flex items-center justify-between px-4 select-none"
    >
      <div className="flex items-center gap-2">
        <span className="text-[#CCCCCC] text-sm font-medium">TweetPilot</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleMinimize}
          className="w-12 h-8 flex items-center justify-center hover:bg-[#2A2A2A] transition-colors"
          aria-label="Minimize"
        >
          <Minus className="w-4 h-4 text-[#CCCCCC]" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-12 h-8 flex items-center justify-center hover:bg-[#2A2A2A] transition-colors"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          <Square className="w-3.5 h-3.5 text-[#CCCCCC]" />
        </button>
        <button
          onClick={handleClose}
          className="w-12 h-8 flex items-center justify-center hover:bg-[#F48771] transition-colors group"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-[#CCCCCC] group-hover:text-white" />
        </button>
      </div>
    </div>
  )
}
