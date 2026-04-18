import { useEffect, useRef, useState } from 'react'

interface ResizableDividerProps {
  side: 'left' | 'right'
  onResize: (width: number) => void
  isVisible?: boolean
}

export function ResizableDivider({ side, onResize, isVisible = true }: ResizableDividerProps) {
  const [dragging, setDragging] = useState(false)
  const dragSideRef = useRef<'left' | 'right'>(side)

  useEffect(() => {
    dragSideRef.current = side
  }, [side])

  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (event: MouseEvent) => {
      if (dragSideRef.current === 'left') {
        onResize(event.clientX - 48)
        return
      }

      onResize(window.innerWidth - event.clientX)
    }

    const handleMouseUp = () => {
      setDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, onResize])

  if (!isVisible) {
    return null
  }

  return (
    <div
      className={[
        'relative w-1 flex-shrink-0 cursor-col-resize transition-colors',
        dragging ? 'bg-[#007ACC]' : 'bg-transparent hover:bg-[#007ACC]',
      ].join(' ')}
      onMouseDown={() => setDragging(true)}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? '调整左侧边栏宽度' : '调整右侧面板宽度'}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
