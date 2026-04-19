import { open } from '@tauri-apps/plugin-dialog'
import { FileCode } from 'lucide-react'
import { useState } from 'react'

interface ScriptSelectorProps {
  value: string
  onChange: (path: string) => void
  disabled?: boolean
}

export function ScriptSelector({ value, onChange, disabled }: ScriptSelectorProps) {
  const [selecting, setSelecting] = useState(false)

  const handleSelect = async () => {
    setSelecting(true)
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Python Scripts',
          extensions: ['py']
        }]
      })

      if (selected && typeof selected === 'string') {
        onChange(selected)
      }
    } catch (err) {
      console.error('Failed to select script:', err)
    } finally {
      setSelecting(false)
    }
  }

  const fileName = value ? value.split('/').pop() || value : ''

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 h-10 rounded border border-[#2A2A2A] bg-[#171718] px-3">
          <FileCode className="w-4 h-4 text-[#858585]" />
          <input
            type="text"
            value={fileName}
            readOnly
            placeholder="点击选择 Python 脚本文件"
            className="flex-1 bg-transparent text-sm text-[#CCCCCC] outline-none placeholder:text-[#858585]"
          />
        </div>
        <button
          type="button"
          onClick={handleSelect}
          disabled={selecting || disabled}
          className="h-10 px-4 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] disabled:opacity-50 transition-colors"
        >
          {selecting ? '选择中...' : '选择脚本'}
        </button>
      </div>
      {value && (
        <div className="text-xs text-[#858585] truncate" title={value}>
          完整路径: {value}
        </div>
      )}
    </div>
  )
}
