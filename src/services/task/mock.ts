import {
  defaultTaskDetails,
  defaultTaskHistory,
  defaultTasks,
} from '../mock-data/tasks'
import type {
  ExecutionResult,
  Task,
  TaskDetail,
  TaskExecutionRecord,
  TaskService,
  TaskStatus,
} from './types'

let tasks: Task[] = [...defaultTasks]
let taskDetailsById: Record<string, TaskDetail> = { ...defaultTaskDetails }
let taskHistoryById: Record<string, TaskExecutionRecord[]> = { ...defaultTaskHistory }

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getTaskOrThrow(taskId: string): Task {
  const task = tasks.find((item) => item.id === taskId)
  if (!task) {
    throw new Error('任务不存在')
  }
  return task
}

function getTaskDetailOrThrow(taskId: string): TaskDetail {
  const detail = taskDetailsById[taskId]
  if (!detail) {
    throw new Error('任务不存在')
  }
  return detail
}

function upsertTaskDetail(task: Task) {
  const existing = taskDetailsById[task.id]

  const nextDetail: TaskDetail = {
    task,
    statistics:
      existing?.statistics ?? {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        averageDuration: 0,
      },
    history: existing?.history ?? [],
    failureLog: existing?.failureLog ?? [],
  }

  taskDetailsById = {
    ...taskDetailsById,
    [task.id]: nextDetail,
  }
}

function toTaskStatusFromExecution(status: ExecutionResult['status']): TaskStatus {
  return status === 'success' ? 'completed' : 'failed'
}

function randomExecutionResult(): ExecutionResult {
  const success = Math.random() >= 0.35
  const duration = Number((1.2 + Math.random() * 2.4).toFixed(2))
  const now = new Date()
  const start = new Date(now.getTime() - Math.floor(duration * 1000))

  if (success) {
    return {
      startTime: start.toISOString(),
      endTime: now.toISOString(),
      status: 'success',
      output: 'Task executed successfully\nProcessed 100 items',
      duration,
    }
  }

  return {
    startTime: start.toISOString(),
    endTime: now.toISOString(),
    status: 'failure',
    output: 'Task started...\nProcessing data...',
    error: 'Error: Connection timeout after 30 seconds',
    duration,
  }
}

function recomputeStats(taskId: string) {
  const detail = getTaskDetailOrThrow(taskId)

  const history = detail.history
  const totalExecutions = history.length
  const successCount = history.filter((item) => item.status === 'success').length
  const failureCount = totalExecutions - successCount
  const successRate = totalExecutions === 0 ? 0 : Number(((successCount / totalExecutions) * 100).toFixed(1))

  const totalDuration = history.reduce((sum, item) => sum + item.duration, 0)
  const averageDuration = totalExecutions === 0 ? 0 : Number((totalDuration / totalExecutions).toFixed(2))

  const nextStatistics = {
    totalExecutions,
    successCount,
    failureCount,
    successRate,
    averageDuration,
  }

  taskDetailsById = {
    ...taskDetailsById,
    [taskId]: {
      ...detail,
      statistics: nextStatistics,
      failureLog: history.filter((item) => item.status === 'failure'),
    },
  }

  tasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          statistics: task.type === 'scheduled' ? nextStatistics : task.statistics,
        }
      : task
  )
}

export const taskMockService: TaskService = {
  async getTasks() {
    await randomDelay(50, 150)
    return [...tasks]
  },

  async getTaskDetail(taskId) {
    await randomDelay(50, 150)
    const detail = getTaskDetailOrThrow(taskId)
    return {
      ...detail,
      task: { ...detail.task },
      history: [...detail.history],
      failureLog: [...detail.failureLog],
    }
  },

  async createTask(config) {
    await randomDelay(100, 250)

    if (!config.name.trim()) {
      throw new Error('任务名称不能为空')
    }

    if (!config.scriptPath.trim()) {
      throw new Error('脚本路径不能为空')
    }

    if (config.taskType === 'scheduled' && !config.schedule?.trim()) {
      throw new Error('定时任务必须提供执行规则')
    }

    const newTask: Task = {
      id: `task_${Date.now()}`,
      name: config.name.trim(),
      description: config.description?.trim() || undefined,
      type: config.taskType,
      status: config.taskType === 'scheduled' ? 'paused' : 'idle',
      scriptPath: config.scriptPath,
      parameters: config.parameters,
      schedule: config.taskType === 'scheduled' ? config.schedule : undefined,
      statistics:
        config.taskType === 'scheduled'
          ? {
              totalExecutions: 0,
              successCount: 0,
              failureCount: 0,
              successRate: 0,
              averageDuration: 0,
            }
          : undefined,
    }

    tasks = [...tasks, newTask]
    upsertTaskDetail(newTask)

    return { ...newTask }
  },

  async updateTask(taskId, config) {
    await randomDelay(100, 250)

    getTaskOrThrow(taskId)

    tasks = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            name: config.name.trim(),
            description: config.description?.trim() || undefined,
            type: config.taskType,
            scriptPath: config.scriptPath,
            schedule: config.taskType === 'scheduled' ? config.schedule : undefined,
            parameters: config.parameters,
          }
        : task
    )

    const updated = getTaskOrThrow(taskId)
    upsertTaskDetail(updated)
  },

  async deleteTask(taskId) {
    await randomDelay(100, 250)

    getTaskOrThrow(taskId)

    tasks = tasks.filter((item) => item.id !== taskId)

    const { [taskId]: _deletedDetail, ...restDetails } = taskDetailsById
    taskDetailsById = restDetails

    const { [taskId]: _deletedHistory, ...restHistory } = taskHistoryById
    taskHistoryById = restHistory
  },

  async pauseTask(taskId) {
    await randomDelay(100, 250)

    const task = getTaskOrThrow(taskId)

    tasks = tasks.map((item) =>
      item.id === taskId ? { ...task, status: 'paused' } : item
    )

    upsertTaskDetail(getTaskOrThrow(taskId))
  },

  async resumeTask(taskId) {
    await randomDelay(100, 250)

    const task = getTaskOrThrow(taskId)

    tasks = tasks.map((item) =>
      item.id === taskId ? { ...task, status: 'running' } : item
    )

    upsertTaskDetail(getTaskOrThrow(taskId))
  },

  async executeTask(taskId) {
    await randomDelay(300, 1500)

    const task = getTaskOrThrow(taskId)
    const result = randomExecutionResult()

    const nextTask: Task = {
      ...task,
      lastExecution: result,
      lastExecutionStatus: result.status,
      lastExecutionTime: result.endTime,
      status: toTaskStatusFromExecution(result.status),
    }

    tasks = tasks.map((item) => (item.id === taskId ? nextTask : item))

    const detail = getTaskDetailOrThrow(taskId)
    taskDetailsById = {
      ...taskDetailsById,
      [taskId]: {
        ...detail,
        task: nextTask,
        history: [result, ...detail.history],
      },
    }

    const existingRecords = taskHistoryById[taskId] ?? []
    taskHistoryById = {
      ...taskHistoryById,
      [taskId]: [
        {
          id: `exec_${Date.now()}`,
          taskId,
          startTime: result.startTime,
          endTime: result.endTime,
          duration: result.duration,
          status: toTaskStatusFromExecution(result.status),
          output: result.output,
          exitCode: result.status === 'success' ? 0 : 1,
        },
        ...existingRecords,
      ],
    }

    recomputeStats(taskId)

    return result
  },

  async getExecutionHistory(taskId, limit) {
    await randomDelay(50, 150)

    getTaskOrThrow(taskId)

    const records = taskHistoryById[taskId] ?? []
    if (!limit || limit <= 0) {
      return [...records]
    }

    return records.slice(0, limit)
  },

  async getTaskStats() {
    await randomDelay(50, 150)

    return {
      total: tasks.length,
      running: tasks.filter((item) => item.status === 'running').length,
      paused: tasks.filter((item) => item.status === 'paused').length,
      failed: tasks.filter((item) => item.status === 'failed').length,
    }
  },
}
