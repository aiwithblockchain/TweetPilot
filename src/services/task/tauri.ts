import type { TaskService } from './types'

function notImplemented(): never {
  throw new Error('Task tauri service is not implemented yet')
}

export const taskTauriService: TaskService = {
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
