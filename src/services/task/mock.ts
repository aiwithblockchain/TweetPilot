import type { TaskService } from './types'

function notImplemented(): never {
  throw new Error('Task mock service is not implemented yet')
}

export const taskMockService: TaskService = {
  async getTasks() {
    return notImplemented()
  },
  async getTaskDetail() {
    return notImplemented()
  },
  async createTask() {
    return notImplemented()
  },
  async updateTask() {
    return notImplemented()
  },
  async deleteTask() {
    return notImplemented()
  },
  async pauseTask() {
    return notImplemented()
  },
  async resumeTask() {
    return notImplemented()
  },
  async executeTask() {
    return notImplemented()
  },
  async getExecutionHistory() {
    return notImplemented()
  },
  async getTaskStats() {
    return notImplemented()
  },
}
