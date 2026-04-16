export interface TaskConfig {
  name: string
  accountScreenName: string
  contentTemplate: string
  scheduleType: 'immediate' | 'scheduled'
  cronExpression?: string
}

export interface TaskItem {
  id: string
  name: string
  status: 'idle' | 'running' | 'paused' | 'failed' | 'completed'
  updatedAt: string
}

export interface TaskDetail extends TaskItem {
  config: TaskConfig
}

export interface TaskExecutionRecord {
  id: string
  taskId: string
  status: 'success' | 'failure'
  message: string
  executedAt: string
}

export interface TaskStats {
  total: number
  running: number
  paused: number
  failed: number
}

export interface TaskService {
  getTasks(): Promise<TaskItem[]>
  getTaskDetail(taskId: string): Promise<TaskDetail>
  createTask(config: TaskConfig): Promise<void>
  updateTask(taskId: string, config: TaskConfig): Promise<void>
  deleteTask(taskId: string): Promise<void>
  pauseTask(taskId: string): Promise<void>
  resumeTask(taskId: string): Promise<void>
  executeTask(taskId: string): Promise<void>
  getExecutionHistory(taskId: string): Promise<TaskExecutionRecord[]>
  getTaskStats(): Promise<TaskStats>
}
