import { taskTauriService } from './tauri'
import type { LoadedSession } from '@/services/ai/tauri'

export type {
  ExecutionResult,
  Task,
  TaskAction,
  TaskConfigInput,
  TaskDetail,
  TaskExecutionMode,
  TaskExecutionRecord,
  TaskExecutionStatus,
  TaskService,
  TaskStats,
  TaskStatus,
  TaskType,
} from './types'

export type { LoadedSession as TaskAiLoadedSession }

export const taskService = taskTauriService
