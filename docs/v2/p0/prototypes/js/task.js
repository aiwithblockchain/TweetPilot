// Task Management

class TaskManager {
  constructor() {
    this.tasks = [];
    this.executionHistory = {};
    this.init();
  }

  init() {
    // Load tasks from storage
    this.tasks = Storage.get('tasks') || [];
    this.executionHistory = Storage.get('execution-history') || {};

    // Start task scheduler
    this.startScheduler();
  }

  async createTask(config) {
    const task = {
      id: generateId(),
      name: config.name,
      description: config.description || '',
      type: config.type,
      scriptPath: config.scriptPath,
      schedule: config.schedule || null,
      parameters: config.parameters || {},
      status: 'paused',
      nextExecutionTime: config.type === 'scheduled' ? this.calculateNextExecution(config.schedule) : null,
      lastExecutionTime: null,
      statistics: {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        averageDuration: 0
      }
    };

    this.tasks.push(task);
    this.executionHistory[task.id] = [];
    this.saveTasks();

    showToast('任务创建成功', 'success');
    window.dispatchEvent(new CustomEvent('tasks-changed'));

    return task;
  }

  async updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    Object.assign(task, updates);

    // Recalculate next execution if schedule changed
    if (updates.schedule && task.type === 'scheduled') {
      task.nextExecutionTime = this.calculateNextExecution(updates.schedule);
    }

    this.saveTasks();
    window.dispatchEvent(new CustomEvent('tasks-changed'));
  }

  async deleteTask(taskId) {
    confirm(
      '确定要删除这个任务吗？',
      () => {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
        delete this.executionHistory[taskId];
        this.saveTasks();
        showToast('任务已删除', 'success');
        window.dispatchEvent(new CustomEvent('tasks-changed'));
      }
    );
  }

  async pauseTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'paused';
    this.saveTasks();
    showToast('任务已暂停', 'success');
    window.dispatchEvent(new CustomEvent('tasks-changed'));
  }

  async resumeTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = 'running';
    if (task.type === 'scheduled' && !task.nextExecutionTime) {
      task.nextExecutionTime = this.calculateNextExecution(task.schedule);
    }
    this.saveTasks();
    showToast('任务已恢复', 'success');
    window.dispatchEvent(new CustomEvent('tasks-changed'));
  }

  async executeTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Check if account is online
    const accounts = accountManager.getAccounts();
    if (accounts.length === 0) {
      showToast('请先映射 Twitter 账号', 'error');
      return;
    }

    const onlineAccounts = accounts.filter(a => a.status === 'online');
    if (onlineAccounts.length === 0) {
      showToast('没有在线的 Twitter 账号', 'error');
      return;
    }

    // Show execution modal
    this.showExecutionModal(task);
  }

  showExecutionModal(task) {
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="mb-lg">
        <h3 class="mb-sm">任务：${task.name}</h3>
        <p class="text-secondary text-small">脚本：${task.scriptPath}</p>
      </div>
      <div class="mb-lg">
        <div class="form-label">执行输出：</div>
        <div id="execution-output" style="
          background-color: #1e1e1e;
          color: #d4d4d4;
          padding: 12px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          min-height: 200px;
          max-height: 400px;
          overflow-y: auto;
          white-space: pre-wrap;
        ">等待执行...</div>
      </div>
      <div id="execution-actions" class="form-actions">
        <button id="start-execution-btn">开始执行</button>
      </div>
    `;

    const modal = showModal(content, '执行任务');
    const outputEl = content.querySelector('#execution-output');
    const actionsEl = content.querySelector('#execution-actions');
    const startBtn = content.querySelector('#start-execution-btn');

    startBtn.onclick = async () => {
      startBtn.disabled = true;
      outputEl.textContent = '正在执行...\n';

      try {
        const result = await mockTaskExecution(task.id);

        outputEl.textContent += result.output + '\n';
        outputEl.textContent += `\n退出码: ${result.exitCode}\n`;
        outputEl.textContent += `执行时长: ${result.duration.toFixed(1)}s\n`;

        // Record execution
        this.recordExecution(task.id, result);

        if (result.success) {
          outputEl.textContent += '\n✓ 执行成功';
          showToast('任务执行成功', 'success');
        } else {
          outputEl.textContent += '\n✗ 执行失败';
          showToast('任务执行失败', 'error');
        }

        actionsEl.innerHTML = '<button onclick="this.closest(\'.modal-overlay\').remove()">关闭</button>';
      } catch (error) {
        outputEl.textContent += `\n错误: ${error.message}`;
        showToast('执行出错', 'error');
        startBtn.disabled = false;
      }
    };
  }

  recordExecution(taskId, result) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    const execution = {
      id: generateId(),
      taskId: taskId,
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + result.duration * 1000).toISOString(),
      duration: result.duration,
      status: result.success ? 'success' : 'failure',
      output: result.output,
      exitCode: result.exitCode
    };

    // Add to history
    if (!this.executionHistory[taskId]) {
      this.executionHistory[taskId] = [];
    }
    this.executionHistory[taskId].unshift(execution);

    // Keep only last 20
    this.executionHistory[taskId] = this.executionHistory[taskId].slice(0, 20);

    // Update task statistics
    task.statistics.totalExecutions++;
    if (result.success) {
      task.statistics.successCount++;
    } else {
      task.statistics.failureCount++;
    }
    task.statistics.successRate = (task.statistics.successCount / task.statistics.totalExecutions * 100).toFixed(1);

    // Update average duration
    const totalDuration = task.statistics.averageDuration * (task.statistics.totalExecutions - 1) + result.duration;
    task.statistics.averageDuration = (totalDuration / task.statistics.totalExecutions).toFixed(1);

    task.lastExecutionTime = execution.endTime;

    this.saveTasks();
    window.dispatchEvent(new CustomEvent('tasks-changed'));
  }

  calculateNextExecution(schedule) {
    // Simple schedule parser (for prototype)
    // In real app, use a proper cron parser
    const now = new Date();

    // Parse simple interval format: "every N minutes/hours/days"
    const match = schedule.match(/every\s+(\d+)\s+(minutes?|hours?|days?)/i);

    if (!match) {
      // Default: 1 hour from now if format is invalid
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    }

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('minute')) {
      return new Date(now.getTime() + value * 60 * 1000).toISOString();
    } else if (unit.startsWith('hour')) {
      return new Date(now.getTime() + value * 60 * 60 * 1000).toISOString();
    } else if (unit.startsWith('day')) {
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000).toISOString();
    }

    // Default: 1 hour from now
    return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  }

  startScheduler() {
    // Check every minute for tasks that need to run
    setInterval(() => {
      const now = new Date();

      this.tasks.forEach(task => {
        if (task.status === 'running' && task.type === 'scheduled' && task.nextExecutionTime) {
          const nextExec = new Date(task.nextExecutionTime);
          if (now >= nextExec) {
            // Execute task
            this.executeTaskInBackground(task.id);

            // Calculate next execution
            task.nextExecutionTime = this.calculateNextExecution(task.schedule);
            this.saveTasks();
          }
        }
      });
    }, 60 * 1000);
  }

  async executeTaskInBackground(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const result = await mockTaskExecution(taskId);
      this.recordExecution(taskId, result);
    } catch (error) {
      console.error('Background execution failed:', error);
    }
  }

  getTasks(filter = 'all') {
    if (filter === 'all') return this.tasks;
    if (filter === 'running') return this.tasks.filter(t => t.status === 'running');
    if (filter === 'paused') return this.tasks.filter(t => t.status === 'paused');
    if (filter === 'failed') {
      return this.tasks.filter(t => {
        const history = this.executionHistory[t.id] || [];
        return history.length > 0 && history[0].status === 'failure';
      });
    }
    return this.tasks;
  }

  getTask(taskId) {
    return this.tasks.find(t => t.id === taskId);
  }

  getExecutionHistory(taskId, limit = 20) {
    return (this.executionHistory[taskId] || []).slice(0, limit);
  }

  saveTasks() {
    Storage.set('tasks', this.tasks);
    Storage.set('execution-history', this.executionHistory);
  }
}

// Initialize task manager
const taskManager = new TaskManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TaskManager, taskManager };
}
