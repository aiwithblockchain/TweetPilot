import { ExecutionResult } from '../pages/TaskManagement'

interface ExecutionResultModalProps {
  result: ExecutionResult
  onClose: () => void
}

export default function ExecutionResultModal({ result, onClose }: ExecutionResultModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-base font-semibold">执行结果</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Status */}
          <div>
            <div className="text-xs text-secondary mb-1">执行状态</div>
            <span
              className={`inline-block px-2 py-1 text-sm rounded ${
                result.status === 'success'
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-red-500/10 text-red-500'
              }`}
            >
              {result.status === 'success' ? '✓ 成功' : '✗ 失败'}
            </span>
          </div>

          {/* Duration */}
          <div>
            <div className="text-xs text-secondary mb-1">耗时</div>
            <div className="text-sm">{result.duration.toFixed(2)} 秒</div>
          </div>

          {/* Output */}
          {result.output && (
            <div>
              <div className="text-xs text-secondary mb-1">输出</div>
              <pre className="text-xs bg-[var(--color-surface)] p-3 rounded overflow-x-auto max-h-[300px] overflow-y-auto">
                {result.output}
              </pre>
            </div>
          )}

          {/* Error */}
          {result.error && (
            <div>
              <div className="text-xs text-secondary mb-1">错误信息</div>
              <pre className="text-xs bg-red-500/10 text-red-500 p-3 rounded overflow-x-auto max-h-[200px] overflow-y-auto">
                {result.error}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="h-8 px-4 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
