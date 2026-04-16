import { serviceMode } from '../runtime'
import { taskMockService } from './mock'
import { taskTauriService } from './tauri'

export type {
  TaskConfig,
  TaskDetail,
  TaskExecutionRecord,
  TaskItem,
  TaskService,
  TaskStats,
} from './types'

export const taskService = serviceMode === 'tauri' ? taskTauriService : taskMockService
