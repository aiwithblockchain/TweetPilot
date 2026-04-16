import type { Task, TaskDetail, TaskExecutionRecord } from '../task/types'

const now = new Date()
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000)
const nextHour = new Date(now.getTime() + 1 * 60 * 60 * 1000)

export const defaultTasks: Task[] = [
  {
    id: 'task_1',
    name: '测试即时任务',
    description: '这是一个测试任务',
    type: 'immediate',
    status: 'idle',
    scriptPath: '/path/to/script.py',
    parameters: {
      topic: 'ai',
      tone: 'friendly',
    },
    lastExecutionTime: oneHourAgo.toISOString(),
    lastExecutionStatus: 'success',
    lastExecution: {
      startTime: twoHoursAgo.toISOString(),
      endTime: oneHourAgo.toISOString(),
      status: 'success',
      output: 'Task completed successfully\nProcessed 50 items',
      duration: 2.1,
    },
  },
  {
    id: 'task_2',
    name: '测试定时任务',
    description: '每小时执行一次',
    type: 'scheduled',
    status: 'running',
    scriptPath: '/path/to/scheduled.py',
    schedule: '0 * * * *',
    parameters: {
      region: 'global',
    },
    nextExecutionTime: nextHour.toISOString(),
    lastExecutionTime: oneHourAgo.toISOString(),
    statistics: {
      totalExecutions: 15,
      successCount: 12,
      failureCount: 3,
      successRate: 80,
      averageDuration: 2.5,
    },
  },
]

export const defaultTaskDetails: Record<string, TaskDetail> = {
  task_1: {
    task: defaultTasks[0],
    statistics: {
      totalExecutions: 6,
      successCount: 5,
      failureCount: 1,
      successRate: 83.3,
      averageDuration: 2.2,
    },
    history: [
      {
        startTime: twoHoursAgo.toISOString(),
        endTime: oneHourAgo.toISOString(),
        status: 'success',
        output: 'Task completed successfully\nProcessed 50 items',
        duration: 2.1,
      },
    ],
    failureLog: [
      {
        startTime: new Date(now.getTime() - 26 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 26 * 60 * 60 * 1000 + 1800).toISOString(),
        status: 'failure',
        output: 'Task started\nProcessing...',
        error: 'Connection timeout',
        duration: 1.8,
      },
    ],
  },
  task_2: {
    task: defaultTasks[1],
    statistics: {
      totalExecutions: 15,
      successCount: 12,
      failureCount: 3,
      successRate: 80,
      averageDuration: 2.5,
    },
    history: [
      {
        startTime: twoHoursAgo.toISOString(),
        endTime: oneHourAgo.toISOString(),
        status: 'success',
        output: 'Scheduled task finished',
        duration: 2.4,
      },
    ],
    failureLog: [
      {
        startTime: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 8 * 60 * 60 * 1000 + 2100).toISOString(),
        status: 'failure',
        output: 'Task started...',
        error: 'Failed to connect to remote server',
        duration: 2.1,
      },
    ],
  },
}

export const defaultTaskHistory: Record<string, TaskExecutionRecord[]> = {
  task_1: [
    {
      id: 'exec_1',
      taskId: 'task_1',
      startTime: twoHoursAgo.toISOString(),
      endTime: oneHourAgo.toISOString(),
      duration: 2.1,
      status: 'completed',
      output: 'Task completed successfully',
      exitCode: 0,
    },
  ],
  task_2: [
    {
      id: 'exec_2',
      taskId: 'task_2',
      startTime: twoHoursAgo.toISOString(),
      endTime: oneHourAgo.toISOString(),
      duration: 2.4,
      status: 'completed',
      output: 'Scheduled task finished',
      exitCode: 0,
    },
  ],
}
