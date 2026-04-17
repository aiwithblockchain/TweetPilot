import { serviceMode } from '../runtime'
import { taskMockService } from './mock'
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

export const taskService = serviceMode === 'tauri' ? taskTauriService : taskMockService
