export type TaskType = 'immediate' | 'scheduled'
export type TaskAction = 'tweetclaw.post_tweet' | 'tweetclaw.reply_tweet' | 'tweetclaw.like_tweet'

export type TaskStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed'

export interface ExecutionResult {
  startTime: string
  endTime: string
  status: 'success' | 'failure'
  output: string
  error?: string
  duration: number
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
  scriptPath: string
  parameters?: Record<string, string>
  status: TaskStatus
  lastExecution?: ExecutionResult
  lastExecutionStatus?: 'success' | 'failure'
  schedule?: string
  nextExecutionTime?: string
  lastExecutionTime?: string
  statistics?: TaskStatistics
  accountScreenName?: string
  tweetId?: string
  query?: string
  text?: string
}

export interface TaskDetail {
  task: Task
  statistics: TaskStatistics
  history: ExecutionResult[]
  failureLog: ExecutionResult[]
}

export interface TaskConfigInput {
  name: string
  description?: string
  taskType: TaskType
  scriptPath: TaskAction | string
  schedule?: string
  parameters?: Record<string, string>
  accountScreenName?: string
  tweetId?: string
  query?: string
  text?: string
}

export interface TaskExecutionRecord {
  id: string
  taskId: string
  startTime: string
  endTime?: string
  duration?: number
  status: TaskStatus
  output?: string
  exitCode?: number
}

export interface TaskStats {
  total: number
  running: number
  paused: number
  failed: number
}

export interface TaskService {
  getTasks(): Promise<Task[]>
  getTaskDetail(taskId: string): Promise<TaskDetail>
  createTask(config: TaskConfigInput): Promise<Task>
  updateTask(taskId: string, config: TaskConfigInput): Promise<void>
  deleteTask(taskId: string): Promise<void>
  pauseTask(taskId: string): Promise<void>
  resumeTask(taskId: string): Promise<void>
  executeTask(taskId: string): Promise<ExecutionResult>
  getExecutionHistory(taskId: string, limit?: number): Promise<TaskExecutionRecord[]>
  getTaskStats(): Promise<TaskStats>
}
