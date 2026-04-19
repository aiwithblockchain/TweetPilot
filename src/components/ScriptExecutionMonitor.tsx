import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface ScriptExecutionMonitorProps {
  output: string
  error?: string
  status: 'idle' | 'running' | 'completed' | 'failed'
}

export function ScriptExecutionMonitor({ output, error, status }: ScriptExecutionMonitorProps) {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#252526] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[#CCCCCC]">脚本执行输出</div>
        <StatusBadge status={status} />
      </div>

      <div className="rounded border border-[#2A2A2A] bg-black/40 p-3 font-mono text-xs text-[#CCCCCC] max-h-96 overflow-y-auto">
        {!output && status === 'idle' && (
          <div className="text-[#858585]">等待脚本执行...</div>
        )}
        {!output && status === 'running' && (
          <div className="text-[#858585]">脚本正在运行...</div>
        )}
        {output && (
          <pre className="whitespace-pre-wrap leading-6">{output}</pre>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded border border-[#5A1D1D] bg-[#3A1F1F] p-3 text-sm text-[#F48771]">
          <div className="font-semibold mb-1">错误信息:</div>
          <pre className="whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ScriptExecutionMonitorProps['status'] }) {
  const config = {
    idle: {
      icon: null,
      label: '空闲',
      className: 'border-[#858585]/30 bg-[#858585]/12 text-[#858585]',
    },
    running: {
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: '运行中',
      className: 'border-[#4EC9B0]/30 bg-[#4EC9B0]/12 text-[#4EC9B0]',
    },
    completed: {
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: '已完成',
      className: 'border-[#4EC9B0]/30 bg-[#4EC9B0]/12 text-[#4EC9B0]',
    },
    failed: {
      icon: <XCircle className="w-3 h-3" />,
      label: '失败',
      className: 'border-[#F48771]/30 bg-[#F48771]/12 text-[#F48771]',
    },
  }

  const { icon, label, className } = config[status]

  return (
    <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${className}`}>
      {icon}
      <span>{label}</span>
    </div>
  )
}
