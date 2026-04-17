import { taskTauriService } from './tauri'

export type {
  ExecutionResult,
  Task,
  TaskAction,
  TaskConfigInput,
  TaskDetail,
  TaskExecutionRecord,
  TaskService,
  TaskStats,
  TaskStatus,
  TaskType,
} from './types'

export const taskService = taskTauriService
