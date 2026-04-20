import { useState } from 'react'
import { taskService } from '@/services'
import type { ExecutionResult, Task } from '@/services/task'
import ExecutingModal from './ExecutingModal'
import ExecutionResultModal from './ExecutionResultModal'

interface TaskActionBarProps {
  task: Task
  onChanged?: () => void
  onDeleted?: () => void
}

export function TaskActionBar({ task, onChanged, onDeleted }: TaskActionBarProps) {
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ExecutionResult | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<'pause' | 'resume' | 'execute' | 'delete' | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleExecute = async () => {
    try {
      setActionError(null)
      setExecuting(true)
      setActionLoading('execute')
      const nextResult = await taskService.executeTask(task.id)
      setExecuting(false)
      setResult(nextResult)
      onChanged?.()
    } catch (error) {
      console.error('Failed to execute task from detail view:', error)
      setExecuting(false)
      setActionError((error as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handlePause = async () => {
    try {
      setActionError(null)
      setActionLoading('pause')
      await taskService.pauseTask(task.id)
      onChanged?.()
    } catch (error) {
      console.error('Failed to pause task from detail view:', error)
      setActionError((error as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleResume = async () => {
    try {
      setActionError(null)
      setActionLoading('resume')
      await taskService.resumeTask(task.id)
      onChanged?.()
    } catch (error) {
      console.error('Failed to resume task from detail view:', error)
      setActionError((error as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    try {
      setActionError(null)
      setActionLoading('delete')
      await taskService.deleteTask(task.id)
      setShowDeleteConfirm(false)
      onDeleted?.()
    } catch (error) {
      console.error('Failed to delete task:', error)
      setActionError((error as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <>
      <section className="rounded-xl border border-[#2A2A2A] bg-[#252526] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
        <div className="text-sm font-semibold text-[#CCCCCC] mb-3">任务操作</div>

        {!showDeleteConfirm ? (
          <div className="flex flex-wrap gap-2">
            {task.type === 'immediate' ? (
              <button
                type="button"
                onClick={handleExecute}
                disabled={actionLoading === 'execute' || task.status === 'running'}
                className="h-9 px-4 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
              >
                {actionLoading === 'execute' ? '执行中...' : '立即执行'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={actionLoading === 'execute' || task.status === 'running'}
                  className="h-9 px-4 rounded bg-[#6D5BF6] text-white text-sm hover:bg-[#5B4AD4] transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'execute' ? '测试中...' : '立即测试'}
                </button>
                {task.status === 'paused' ? (
                  <button
                    type="button"
                    onClick={handleResume}
                    disabled={actionLoading === 'resume'}
                    className="h-9 px-4 rounded bg-[#007ACC] text-white text-sm hover:bg-[#1485D1] transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'resume' ? '恢复中...' : '恢复调度'}
                  </button>
                ) : task.status !== 'running' ? (
                  <button
                    type="button"
                    onClick={handlePause}
                    disabled={actionLoading === 'pause'}
                    className="h-9 px-4 rounded bg-[#D7BA7D]/15 border border-[#D7BA7D]/40 text-sm text-[#D7BA7D] hover:bg-[#D7BA7D]/25 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'pause' ? '暂停中...' : '暂停调度'}
                  </button>
                ) : null}
              </>
            )}

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={task.status === 'running'}
              className="h-9 px-4 rounded bg-[#F48771]/15 border border-[#F48771]/40 text-sm text-[#F48771] hover:bg-[#F48771]/25 transition-colors disabled:opacity-50"
            >
              删除任务
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#F48771] font-medium">确认删除此任务？</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={actionLoading === 'delete'}
              className="h-9 px-4 rounded bg-[#F48771] text-white text-sm hover:bg-[#E6705F] transition-colors disabled:opacity-50"
            >
              {actionLoading === 'delete' ? '删除中...' : '确认删除'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="h-9 px-4 rounded bg-[#2A2A2A] text-[#CCCCCC] text-sm hover:bg-[#3A3A3A] transition-colors"
            >
              取消
            </button>
          </div>
        )}

        {actionError && (
          <div className="mt-3 rounded-lg border border-[#5A1D1D] bg-[#3A1F1F] px-3 py-2 text-sm text-[#F48771]">
            {actionError}
          </div>
        )}
      </section>

      {executing && <ExecutingModal taskName={task.name} />}
      {result && <ExecutionResultModal result={result} onClose={() => setResult(null)} />}
    </>
  )
}
