export type TaskType = 'immediate' | 'scheduled'

export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed'

export type ScheduleType = 'cron' | 'interval'

export interface ExecutionResult {
  id: string
  taskId: string
  startTime: string
  endTime: string
  duration: number
  status: 'success' | 'failure'
  exitCode: number
  output?: string
  error?: string
  stdout?: string
  stderr?: string
  metadata?: Record<string, any>
}

export interface TaskStatistics {
  totalExecutions: number
  successCount: number
  failureCount: number
  successRate: number
  averageDuration: number
}

export interface Task {
  id: string
  name: string
  description?: string
  type: TaskType
  status: TaskStatus
  enabled: boolean
  scriptPath: string
  scriptContent?: string
  scriptHash?: string
  schedule?: string
  scheduleType: ScheduleType
  intervalSeconds?: number
  timeout?: number
  retryCount?: number
  retryDelay?: number
  accountId: string
  accountScreenName?: string
  parameters: Record<string, any>
  lastExecution?: ExecutionResult
  lastExecutionTime?: string
  nextExecutionTime?: string
  statistics: TaskStatistics
  createdAt: string
  updatedAt: string
  tags?: string[]
  tweetId?: string
  text?: string
  lastExecutionStatus?: 'success' | 'failure'
}

export interface TaskDetail {
  task: Task
  statistics: TaskStatistics
  history: ExecutionResult[]
}

export interface TaskConfigInput {
  name: string
  description?: string
  taskType: TaskType
  scriptPath: string
  schedule?: string
  scheduleType?: ScheduleType
  intervalSeconds?: number
  timeout?: number
  retryCount?: number
  retryDelay?: number
  accountScreenName?: string
  parameters?: Record<string, any>
  tags?: string[]
}

export type TaskAction = 'start' | 'stop' | 'pause' | 'resume'

export type TaskExecutionRecord = ExecutionResult

export type TaskStats = TaskStatistics

export interface TaskService {
  getTasks(): Promise<Task[]>
  getTaskDetail(taskId: string): Promise<TaskDetail>
  createTask(config: TaskConfigInput): Promise<Task>
  updateTask(taskId: string, config: Partial<TaskConfigInput>): Promise<void>
  deleteTask(taskId: string): Promise<void>
  pauseTask(taskId: string): Promise<void>
  resumeTask(taskId: string): Promise<void>
  executeTask(taskId: string): Promise<ExecutionResult>
  getExecutionHistory(taskId: string, limit?: number): Promise<ExecutionResult[]>
}
