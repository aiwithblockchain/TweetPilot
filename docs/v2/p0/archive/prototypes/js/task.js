// Task Management

class TaskManager {
  constructor() {
    this.tasks = [];
    this.executionHistory = {}; // 仅定时任务
    this.failureLog = {}; // 所有任务的失败记录
    this.init();
  }

  init() {
    // Load tasks from storage
    this.tasks = Storage.get('tasks') || [];
    this.executionHistory = Storage.get('execution-history') || {};
    this.failureLog = Storage.get('failure-log') || {};

    // Start task scheduler
    this.startScheduler();
  }

  async createTask(config) {
    const baseTask = {
      id: generateId(),
      name: config.name,
      description: config.description || '',
      type: config.type,
      scriptPath: config.scriptPath,
      parameters: config.parameters || {}
    };

    let task;
    if (config.type === 'immediate') {
      // 即时任务
      task = {
        ...baseTask,
        status: 'idle', // idle | running
        lastExecution: null
      };
    } else {
      // 定时任务
      task = {
        ...baseTask,
        schedule: config.schedule,
        status: 'paused', // running | paused
        nextExecutionTime: this.calculateNextExecution(config.schedule),
        lastExecutionTime: null,
        statistics: {
          totalExecutions: 0,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
          averageDuration: 0
        }
      };
      this.executionHistory[task.id] = [];
    }

    this.tasks.push(task);
    this.failureLog[task.id] = [];
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
        delete this.failureLog[taskId];
        this.saveTasks();
        showToast('任务已删除', 'success');
        window.dispatchEvent(new CustomEvent('tasks-changed'));
      }
    );
  }

  updateTaskParameters(taskId, parameters) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.parameters = parameters;
    this.saveTasks();
    window.dispatchEvent(new CustomEvent('tasks-changed'));
  }

  async pauseTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || task.type !== 'scheduled') return;

    task.status = 'paused';
    this.saveTasks();
    showToast('任务已暂停', 'success');
    window.dispatchEvent(new CustomEvent('tasks-changed'));
  }

  async resumeTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task || task.type !== 'scheduled') return;

    task.status = 'running';
    if (!task.nextExecutionTime) {
      task.nextExecutionTime = this.calculateNextExecution(task.schedule);
    }
    this.saveTasks();
    showToast('任务已恢复', 'success');
    window.dispatchEvent(new CustomEvent('tasks-changed'));
  }

  async executeTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.type === 'immediate') {
      // 即时任务：立即执行并显示结果
      await this.executeImmediateTask(task);
    } else {
      // 定时任务：手动触发执行
      await this.executeScheduledTask(task, true);
    }
  }

  async executeImmediateTask(task) {
    // 更新状态为执行中
    task.status = 'running';
    window.dispatchEvent(new CustomEvent('tasks-changed'));

    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    try {
      // 模拟执行
      const result = await mockTaskExecution(task.scriptPath, task.parameters);
      const endTime = new Date().toISOString();
      const duration = (Date.now() - startTimestamp) / 1000;

      const execution = {
        startTime,
        endTime,
        status: result.success ? 'success' : 'failure',
        output: result.output,
        error: result.error || null,
        duration
      };

      // 保存最后一次执行结果
      task.lastExecution = execution;

      // 如果失败，记录到失败日志
      if (!result.success) {
        this.failureLog[task.id].unshift({
          ...execution,
          taskType: 'immediate'
        });
      }

      task.status = 'idle';
      this.saveTasks();
      window.dispatchEvent(new CustomEvent('tasks-changed'));

    } catch (error) {
      const endTime = new Date().toISOString();
      const duration = (Date.now() - startTimestamp) / 1000;

      const execution = {
        startTime,
        endTime,
        status: 'failure',
        output: '',
        error: error.message,
        duration
      };

      task.lastExecution = execution;
      this.failureLog[task.id].unshift({
        ...execution,
        taskType: 'immediate'
      });

      task.status = 'idle';
      this.saveTasks();
      window.dispatchEvent(new CustomEvent('tasks-changed'));
    }
  }

  async executeScheduledTask(task, isManual = false) {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    try {
      // 模拟执行
      const result = await mockTaskExecution(task.scriptPath, task.parameters);
      const endTime = new Date().toISOString();
      const duration = (Date.now() - startTimestamp) / 1000;

      const execution = {
        startTime,
        endTime,
        status: result.success ? 'success' : 'failure',
        output: result.output,
        error: result.error || null,
        duration
      };

      // 记录到执行历史
      this.executionHistory[task.id].unshift(execution);

      // 如果失败，记录到失败日志
      if (!result.success) {
        this.failureLog[task.id].unshift({
          ...execution,
          taskType: 'scheduled'
        });
      }

      // 更新统计数据
      task.statistics.totalExecutions++;
      if (result.success) {
        task.statistics.successCount++;
      } else {
        task.statistics.failureCount++;
      }
      task.statistics.successRate = ((task.statistics.successCount / task.statistics.totalExecutions) * 100).toFixed(1);

      // 更新平均耗时
      const totalDuration = task.statistics.averageDuration * (task.statistics.totalExecutions - 1) + duration;
      task.statistics.averageDuration = (totalDuration / task.statistics.totalExecutions).toFixed(1);

      // 更新执行时间
      task.lastExecutionTime = endTime;
      if (!isManual && task.status === 'running') {
        task.nextExecutionTime = this.calculateNextExecution(task.schedule);
      }

      this.saveTasks();
      window.dispatchEvent(new CustomEvent('tasks-changed'));

      if (isManual) {
        showToast(result.success ? '任务执行成功' : '任务执行失败', result.success ? 'success' : 'error');
      }

    } catch (error) {
      const endTime = new Date().toISOString();
      const duration = (Date.now() - startTimestamp) / 1000;

      const execution = {
        startTime,
        endTime,
        status: 'failure',
        output: '',
        error: error.message,
        duration
      };

      this.executionHistory[task.id].unshift(execution);
      this.failureLog[task.id].unshift({
        ...execution,
        taskType: 'scheduled'
      });

      task.statistics.totalExecutions++;
      task.statistics.failureCount++;
      task.statistics.successRate = ((task.statistics.successCount / task.statistics.totalExecutions) * 100).toFixed(1);

      task.lastExecutionTime = endTime;
      if (!isManual && task.status === 'running') {
        task.nextExecutionTime = this.calculateNextExecution(task.schedule);
      }

      this.saveTasks();
      window.dispatchEvent(new CustomEvent('tasks-changed'));

      if (isManual) {
        showToast('任务执行失败', 'error');
      }
    }
  }

  showExecutionResult(task, execution) {
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="form-group">
        <div class="form-label">任务名称</div>
        <div>${task.name}</div>
      </div>
      <div class="form-group">
        <div class="form-label">执行状态</div>
        <div class="status ${execution.status}">${execution.status === 'success' ? '成功' : '失败'}</div>
      </div>
      <div class="form-group">
        <div class="form-label">执行时间</div>
        <div>${formatDate(execution.startTime)}</div>
      </div>
      <div class="form-group">
        <div class="form-label">耗时</div>
        <div>${execution.duration.toFixed(2)} 秒</div>
      </div>
      ${execution.output ? `
        <div class="form-group">
          <div class="form-label">输出</div>
          <pre style="background: var(--color-bg-secondary); padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${execution.output}</pre>
        </div>
      ` : ''}
      ${execution.error ? `
        <div class="form-group">
          <div class="form-label">错误信息</div>
          <pre style="background: #fee; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; color: var(--color-danger);">${execution.error}</pre>
        </div>
      ` : ''}
    `;

    showModal(content, '执行结果');
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
        if (task.type === 'scheduled' && task.status === 'running' && task.nextExecutionTime) {
          const nextExecution = new Date(task.nextExecutionTime);
          if (now >= nextExecution) {
            this.executeScheduledTask(task, false);
          }
        }
      });
    }, 60000); // Check every minute
  }

  // Background execution (for testing)
  async executeInBackground(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await this.executeTask(taskId);
    } catch (error) {
      console.error('Background execution failed:', error);
    }
  }

  getTasks(filter = 'all') {
    if (filter === 'all') return this.tasks;
    if (filter === 'immediate') return this.tasks.filter(t => t.type === 'immediate');
    if (filter === 'scheduled') return this.tasks.filter(t => t.type === 'scheduled');
    if (filter === 'failed') {
      // 返回有失败记录的任务
      return this.tasks.filter(t => {
        const failures = this.failureLog[t.id] || [];
        return failures.length > 0;
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

  getFailureLog(taskId, limit = 20) {
    return (this.failureLog[taskId] || []).slice(0, limit);
  }

  saveTasks() {
    Storage.set('tasks', this.tasks);
    Storage.set('execution-history', this.executionHistory);
    Storage.set('failure-log', this.failureLog);
  }
}

// Initialize task manager
const taskManager = new TaskManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TaskManager, taskManager };
}
