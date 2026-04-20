import { tauriInvoke } from '@/lib/tauri-api'
import type {
  ExecutionResult,
  Task,
  TaskConfigInput,
  TaskDetail,
  TaskService,
  TaskStats,
  TaskStatus,
  TaskType,
} from './types'

interface TauriTaskConfigInput {
  name: string
  description?: string
  type: TaskType
  script_path: string
  schedule?: string
  schedule_type?: string
  interval_seconds?: number
  parameters?: Record<string, string>
  account_id: string
}

interface TauriTask {
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
  accountScreenName?: string
  tweetId?: string
  query?: string
  text?: string
  statistics?: {
    totalExecutions: number
    successCount: number
    failureCount: number
    successRate: number
    averageDuration: number
  }
}

interface TauriTaskDetail {
  task: TauriTask
  statistics: {
    totalExecutions: number
    successCount: number
    failureCount: number
    successRate: number
    averageDuration: number
  }
  history: ExecutionResult[]
  failureLog: ExecutionResult[]
}

interface TauriTaskExecutionRecord {
  id: string
  taskId: string
  startTime: string
  endTime?: string
  duration?: number
  status: TaskStatus
  output?: string
  exitCode?: number
}

function mapTask(task: TauriTask): Task {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    type: task.type,
    scriptPath: task.scriptPath,
    parameters: task.parameters,
    status: task.status,
    lastExecution: task.lastExecution,
    lastExecutionStatus: task.lastExecutionStatus,
    schedule: task.schedule,
    nextExecutionTime: task.nextExecutionTime,
    lastExecutionTime: task.lastExecutionTime,
    statistics: task.statistics,
    accountScreenName: (task as TauriTask & { accountScreenName?: string }).accountScreenName,
    tweetId: (task as TauriTask & { tweetId?: string }).tweetId,
    query: (task as TauriTask & { query?: string }).query,
    text: (task as TauriTask & { text?: string }).text,
  }
}

function mapTaskDetail(detail: TauriTaskDetail): TaskDetail {
  return {
    task: mapTask(detail.task),
    statistics: detail.statistics,
    history: detail.history,
    failureLog: detail.failureLog,
  }
}

function toTauriTaskConfig(config: TaskConfigInput): TauriTaskConfigInput {
  return {
    name: config.name,
    description: config.description,
    type: config.taskType,
    script_path: config.scriptPath,
    schedule: config.schedule,
    schedule_type: config.scheduleType,
    interval_seconds: config.intervalSeconds,
    parameters: config.parameters,
    account_id: config.accountScreenName || '',
  }
}

export const taskTauriService: TaskService = {
  async getTasks() {
    const result = await tauriInvoke<TauriTask[]>('get_tasks')
    return result.map(mapTask)
  },

  async getTaskDetail(taskId) {
    const result = await tauriInvoke<TauriTaskDetail>('get_task_detail', { taskId })
    return mapTaskDetail(result)
  },

  async createTask(config) {
    const result = await tauriInvoke<TauriTask>('create_task', {
      config: toTauriTaskConfig(config),
    })
    return mapTask(result)
  },

  async updateTask(taskId, config) {
    await tauriInvoke<void>('update_task', {
      taskId,
      config: toTauriTaskConfig(config),
    })
  },

  async deleteTask(taskId) {
    await tauriInvoke<void>('delete_task', { taskId })
  },

  async pauseTask(taskId) {
    await tauriInvoke<void>('pause_task', { taskId })
  },

  async resumeTask(taskId) {
    await tauriInvoke<void>('resume_task', { taskId })
  },

  async executeTask(taskId) {
    return tauriInvoke<ExecutionResult>('execute_task', { taskId })
  },

  async getExecutionHistory(taskId, limit) {
    const result = await tauriInvoke<TauriTaskExecutionRecord[]>('get_execution_history', {
      taskId,
      limit,
    })
    return result.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      startTime: item.startTime,
      endTime: item.endTime,
      duration: item.duration,
      status: item.status,
      output: item.output,
      exitCode: item.exitCode,
    }))
  },

  async getTaskStats() {
    const tasks = await this.getTasks()
    return {
      total: tasks.length,
      running: tasks.filter((item) => item.status === 'running').length,
      paused: tasks.filter((item) => item.status === 'paused').length,
      failed: tasks.filter((item) => item.status === 'failed').length,
    } satisfies TaskStats
  },
}
