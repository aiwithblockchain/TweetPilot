import { Plus, X } from 'lucide-react'
import { useState } from 'react'

interface ParameterEditorProps {
  value: Record<string, string>
  onChange: (params: Record<string, string>) => void
}

export function ParameterEditor({ value, onChange }: ParameterEditorProps) {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    if (!newKey.trim()) return
    onChange({ ...value, [newKey.trim()]: newValue.trim() })
    setNewKey('')
    setNewValue('')
  }

  const handleRemove = (key: string) => {
    const updated = { ...value }
    delete updated[key]
    onChange(updated)
  }

  const entries = Object.entries(value)

  return (
    <div className="space-y-2">
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-input)] p-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="text-sm text-[var(--color-text)] font-mono">--{key}</div>
                <div className="text-sm text-[var(--color-text-secondary)] truncate">{val || '(空值)'}</div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[#F48771] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="参数名"
          className="flex-1 h-9 rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#6D5BF6]"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="参数值"
          className="flex-1 h-9 rounded border border-[var(--color-border)] bg-[var(--color-input)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[#6D5BF6]"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newKey.trim()}
          className="h-9 px-3 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      </div>

      <div className="text-xs text-[var(--color-text-secondary)]">
        参数当前仅用于存储，执行链路暂不消费，后续会单独设计使用方式
      </div>
    </div>
  )
}
