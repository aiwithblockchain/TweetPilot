import { tauriInvoke } from '@/lib/tauri-api'
import type { LoadedSession } from '@/services/ai/tauri'
import type {
  ExecutionDetail,
  ExecutionResult,
  ScheduleType,
  Task,
  TaskConfigInput,
  TaskDetail,
  TaskExecutionStatus,
  TaskService,
  TaskStatus,
  TaskType,
} from './types'

interface TauriTaskConfigInput {
  name?: string
  description?: string
  type?: TaskType
  execution_mode?: 'script' | 'ai_session'
  use_persona?: boolean
  persona_prompt?: string
  script_path?: string
  schedule?: string
  schedule_type?: string
  interval_seconds?: number
  parameters?: Record<string, any>
  account_id?: string
  timeout?: number
  retry_count?: number
  retry_delay?: number
  tags?: string[]
}

interface TauriTask {
  id: string
  name: string
  description?: string
  type: TaskType
  status: TaskStatus
  enabled?: boolean
  executionMode?: 'script' | 'ai_session'
  usePersona?: boolean
  personaPrompt?: string
  scriptPath: string
  scriptContent?: string
  scriptHash?: string
  parameters?: Record<string, any> | string
  lastExecution?: TauriTaskExecutionRecord
  lastExecutionStatus?: 'success' | 'failure'
  schedule?: string
  scheduleType?: string
  intervalSeconds?: number
  nextExecutionTime?: string
  lastExecutionTime?: string
  accountId?: string
  accountScreenName?: string
  tweetId?: string
  text?: string
  createdAt?: string
  updatedAt?: string
  timeout?: number
  retryCount?: number
  retryDelay?: number
  tags?: string[] | string
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
  history: TauriTaskExecutionRecord[]
}

interface TauriTaskExecutionRecord {
  id: string
  taskId: string
  runNo?: number | null
  sessionCode?: string | null
  taskSessionId?: string | null
  startTime: string
  endTime?: string
  duration?: number
  status: string
  exitCode?: number
  stdout?: string
  stderr?: string
  finalOutput?: string | null
  errorMessage?: string | null
  metadata?: Record<string, any> | string | null
  command?: string | null
  workingDirectory?: string | null
  scriptPath?: string | null
}

interface TauriExecutionDetail {
  execution: TauriTaskExecutionRecord
  session?: LoadedSession | null
}

function normalizeTaskParameters(parameters: unknown): Record<string, any> {
  if (!parameters) return {}

  if (typeof parameters === 'string') {
    try {
      const parsed = JSON.parse(parameters) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>
      }
      return {}
    } catch {
      return {}
    }
  }

  if (typeof parameters === 'object' && !Array.isArray(parameters)) {
    return parameters as Record<string, any>
  }

  return {}
}

function normalizeTags(tags: unknown): string[] {
  if (!tags) return []

  if (Array.isArray(tags)) {
    return tags.filter((tag): tag is string => typeof tag === 'string')
  }

  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags) as unknown
      return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
    } catch {
      return []
    }
  }

  return []
}

function normalizeMetadata(metadata: unknown): Record<string, any> | undefined {
  if (!metadata) return undefined

  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>
      }
      return undefined
    } catch {
      return undefined
    }
  }

  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, any>
  }

  return undefined
}

function normalizeExecutionStatus(status: string): TaskExecutionStatus {
  if (status === 'pending' || status === 'running' || status === 'success' || status === 'failure') {
    return status
  }

  if (status === 'failed') {
    return 'failure'
  }

  return 'failure'
}

function mapExecution(item: TauriTaskExecutionRecord): ExecutionResult {
  return {
    id: item.id,
    taskId: item.taskId,
    runNo: item.runNo ?? undefined,
    sessionCode: item.sessionCode ?? undefined,
    taskSessionId: item.taskSessionId ?? undefined,
    startTime: item.startTime,
    endTime: item.endTime || '',
    duration: item.duration || 0,
    status: normalizeExecutionStatus(item.status),
    exitCode: item.exitCode || 0,
    output: item.finalOutput || item.stdout,
    error: item.errorMessage || item.stderr,
    stdout: item.stdout,
    stderr: item.stderr,
    finalOutput: item.finalOutput ?? undefined,
    errorMessage: item.errorMessage ?? undefined,
    metadata: normalizeMetadata(item.metadata),
    command: item.command ?? normalizeMetadata(item.metadata)?.command,
    workingDirectory: item.workingDirectory ?? normalizeMetadata(item.metadata)?.workingDirectory,
    scriptPath: item.scriptPath ?? normalizeMetadata(item.metadata)?.scriptPath,
  }
}

function mapExecutionDetail(detail: TauriExecutionDetail): ExecutionDetail {
  return {
    execution: mapExecution(detail.execution),
    session: detail.session ?? null,
  }
}

function mapTask(task: TauriTask): Task {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    type: task.type,
    status: task.status,
    enabled: task.enabled ?? true,
    executionMode: task.executionMode || 'script',
    usePersona: task.usePersona ?? false,
    personaPrompt: task.personaPrompt ?? undefined,
    scriptPath: task.scriptPath,
    scriptContent: task.scriptContent,
    scriptHash: task.scriptHash,
    parameters: normalizeTaskParameters(task.parameters),
    lastExecution: task.lastExecution ? mapExecution(task.lastExecution) : undefined,
    lastExecutionStatus: task.lastExecutionStatus,
    schedule: task.schedule,
    scheduleType: (task.scheduleType || 'cron') as ScheduleType,
    intervalSeconds: task.intervalSeconds,
    nextExecutionTime: task.nextExecutionTime,
    lastExecutionTime: task.lastExecutionTime,
    statistics: task.statistics || {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      averageDuration: 0,
    },
    accountId: task.accountId || '',
    accountScreenName: task.accountScreenName,
    tweetId: task.tweetId,
    text: task.text,
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || new Date().toISOString(),
    timeout: task.timeout,
    retryCount: task.retryCount,
    retryDelay: task.retryDelay,
    tags: normalizeTags(task.tags),
  }
}

function mapTaskDetail(detail: TauriTaskDetail): TaskDetail {
  return {
    task: mapTask(detail.task),
    statistics: detail.statistics,
    history: detail.history.map(mapExecution),
  }
}

function toTauriTaskConfig(config: Partial<TaskConfigInput>): Partial<TauriTaskConfigInput> {
  return {
    name: config.name,
    description: config.description,
    type: config.taskType,
    execution_mode: config.executionMode,
    use_persona: config.usePersona,
    persona_prompt: config.personaPrompt,
    script_path: config.scriptPath,
    schedule: config.schedule,
    schedule_type: config.scheduleType,
    interval_seconds: config.intervalSeconds,
    parameters: config.parameters,
    account_id: config.accountId || '',
    timeout: config.timeout,
    retry_count: config.retryCount,
    retry_delay: config.retryDelay,
    tags: config.tags,
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
    const result = await tauriInvoke<TauriTaskExecutionRecord>('execute_task', { taskId })
    return mapExecution(result)
  },

  async getExecutionHistory(taskId, limit) {
    const result = await tauriInvoke<TauriTaskExecutionRecord[]>('get_execution_history', {
      taskId,
      limit,
    })
    return result.map(mapExecution)
  },

  async getExecutionDetail(executionId) {
    const result = await tauriInvoke<TauriExecutionDetail>('get_execution_detail', { executionId })
    return mapExecutionDetail(result)
  },

  async getTaskAiSession(sessionId) {
    return tauriInvoke<LoadedSession>('get_task_ai_session', { sessionId })
  },

  async clearTaskExecutionHistory(taskId) {
    await tauriInvoke<void>('clear_task_execution_history', { taskId })
  },
}
