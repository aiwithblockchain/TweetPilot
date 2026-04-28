import type { ExecutionResult } from '@/services/task'

interface ExecutionResultModalProps {
  result: ExecutionResult
  onClose: () => void
}

export default function ExecutionResultModal({ result, onClose }: ExecutionResultModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg)] rounded-lg w-full max-w-3xl max-h-[85vh] flex flex-col mx-4 border border-[var(--color-border)] shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-text)]">执行详情</h3>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">{result.startTime}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-surface)] rounded transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DetailCard
              label="执行状态"
              value={result.status === 'success' ? '成功' : '失败'}
              tone={result.status === 'success' ? 'success' : 'error'}
            />
            <DetailCard label="退出码" value={String(result.exitCode)} />
            <DetailCard label="耗时" value={`${result.duration.toFixed(2)}s`} />
            <DetailCard label="执行编号" value={result.runNo ? String(result.runNo) : '-'} />
          </section>

          {result.error && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-[#F48771]">错误信息</div>
                <button
                  onClick={() => navigator.clipboard.writeText(result.error || '')}
                  className="text-[10px] px-2 py-1 rounded bg-red-900/30 text-[#F48771] hover:bg-[#6A2D2D] transition-colors cursor-pointer"
                >
                  复制
                </button>
              </div>
              <pre className="text-xs bg-red-950/30 border border-red-800/50 text-[#F48771] p-3 rounded-lg overflow-x-auto max-h-[260px] overflow-y-auto whitespace-pre-wrap break-words">
                {result.error}
              </pre>
            </section>
          )}

          {result.output && (
            <section>
              <div className="text-sm font-medium text-[var(--color-text)] mb-2">输出</div>
              <pre className="text-xs bg-[var(--color-surface)] border border-[var(--color-border)] p-3 rounded-lg overflow-x-auto max-h-[240px] overflow-y-auto whitespace-pre-wrap break-words">
                {result.output}
              </pre>
            </section>
          )}

          {(result.scriptPath || result.workingDirectory || result.command) && (
            <section>
              <div className="text-sm font-medium text-[var(--color-text)] mb-2">执行上下文</div>
              <div className="space-y-2 text-xs">
                {result.scriptPath && <MetaRow label="脚本路径" value={result.scriptPath} />}
                {result.workingDirectory && <MetaRow label="工作目录" value={result.workingDirectory} />}
                {result.command && <MetaRow label="执行命令" value={result.command} mono />}
              </div>
            </section>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="h-8 px-4 text-sm bg-[#6D5BF6] text-white rounded hover:bg-[#5B4AD4] transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'error'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-[#4EC9B0]'
      : tone === 'error'
        ? 'text-[#F48771]'
        : 'text-[var(--color-text)]'

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="text-[11px] text-[var(--color-text-secondary)]">{label}</div>
      <div className={`text-sm mt-1 ${toneClass}`}>{value}</div>
    </div>
  )
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="text-[11px] text-[var(--color-text-secondary)] mb-1">{label}</div>
      <div className={[mono ? 'font-mono' : '', 'text-[var(--color-text)] break-words'].join(' ')}>{value}</div>
    </div>
  )
}
