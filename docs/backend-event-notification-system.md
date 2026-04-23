# 后端事件通知系统实现方案

## 版本信息
- **版本**: v1.0
- **创建时间**: 2026-04-23
- **目标**: 实现后端定时器执行后自动通知前端刷新数据

## 一、问题描述

### 当前问题
用户创建定时任务后，任务在后台正常执行，但前端界面不会自动更新，必须手动切换页面才能看到最新的执行记录和统计数据。

### 根本原因
缺少后端到前端的事件通知机制。当前架构：
```
定时器执行 → 更新数据库 → ❌ 前端不知道
```

需要的架构：
```
定时器执行 → 更新数据库 → ✅ 发送事件 → 前端监听 → 自动刷新
```

## 二、技术方案

### 2.1 Tauri Event System

Tauri 提供了内置的事件系统，支持后端向前端发送事件。

**后端发送事件**:
```rust
use tauri::{AppHandle, Manager};

app_handle.emit_all("task-executed", payload)?;
```

**前端监听事件**:
```typescript
import { listen } from '@tauri-apps/api/event'

const unlisten = await listen('task-executed', (event) => {
  console.log('Task executed:', event.payload)
  // 刷新数据
})
```

### 2.2 事件类型设计

定义以下事件类型：

| 事件名称 | 触发时机 | Payload 结构 |
|---------|---------|-------------|
| `task-executed` | 任务执行完成 | `{ taskId, status, duration, timestamp }` |
| `task-created` | 创建新任务 | `{ taskId, name }` |
| `task-updated` | 更新任务配置 | `{ taskId }` |
| `task-deleted` | 删除任务 | `{ taskId }` |
| `workspace-changed` | 切换工作区 | `{ workspacePath }` |

## 三、实现步骤

### Phase 1: 后端事件发送

#### 1.1 修改 `PythonScriptExecutor`

在任务执行完成后发送事件通知。

**文件**: `src-tauri/src/unified_timer/executors/python_script.rs`

```rust
use crate::unified_timer::types::{ExecutionContext, ExecutionResult, Timer};
use crate::unified_timer::executor::TimerExecutor;
use crate::task_database::TaskDatabase;
use async_trait::async_trait;
use std::process::{Command, Stdio};
use std::time::Instant;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

pub struct PythonScriptExecutor {
    python_path: String,
    workspace_root: String,
    db: Arc<Mutex<TaskDatabase>>,
    app_handle: Option<AppHandle>,  // 新增：用于发送事件
}

impl PythonScriptExecutor {
    pub fn new(
        workspace_root: String, 
        db: Arc<Mutex<TaskDatabase>>,
        app_handle: Option<AppHandle>  // 新增参数
    ) -> Self {
        Self {
            python_path: "python3".to_string(),
            workspace_root,
            db,
            app_handle,
        }
    }
}

#[async_trait]
impl TimerExecutor for PythonScriptExecutor {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String> {
        // ... 现有执行逻辑 ...

        // 执行完成后发送事件
        if let Some(ref app) = self.app_handle {
            if context.timer_id.starts_with("task-") {
                let task_id = context.timer_id.strip_prefix("task-").unwrap();
                let _ = app.emit_all("task-executed", serde_json::json!({
                    "taskId": task_id,
                    "status": if success { "success" } else { "failed" },
                    "duration": duration,
                    "timestamp": end_time.to_rfc3339(),
                }));
            }
        }

        // ... 返回结果 ...
    }
}
```

#### 1.2 修改 `WorkspaceContext::start_timers()`

传递 `AppHandle` 给 `PythonScriptExecutor`。

**文件**: `src-tauri/src/task_commands.rs`

```rust
impl WorkspaceContext {
    pub async fn start_timers(&self, app_handle: AppHandle) -> Result<(), String> {
        // ... 现有代码 ...

        log::info!("[WorkspaceContext] Registering python_script executor");
        self.timer_manager.register_executor(
            "python_script".to_string(),
            Arc::new(PythonScriptExecutor::new(
                self.workspace_path.clone(), 
                self.db.clone(),
                Some(app_handle)  // 传递 AppHandle
            )),
        ).await;

        // ... 现有代码 ...
    }
}
```

#### 1.3 修改 `set_current_workspace`

传递 `AppHandle` 给 `start_timers`。

**文件**: `src-tauri/src/commands/workspace.rs`

```rust
#[tauri::command]
pub async fn set_current_workspace(
    path: String,
    task_state: tauri::State<'_, crate::task_commands::TaskState>,
    app: AppHandle,  // 新增参数
) -> Result<(), String> {
    // ... 现有代码 ...

    // Step 3: 启动定时器系统
    log::info!("[set_current_workspace] Starting timers for new workspace");
    new_ctx.start_timers(app).await?;  // 传递 AppHandle

    // ... 现有代码 ...
}
```

#### 1.4 更新其他任务操作命令

在 `create_task`、`update_task`、`delete_task` 等命令中也发送相应事件。

```rust
#[tauri::command]
pub async fn create_task(
    config: TaskConfigInput,
    state: State<'_, TaskState>,
    app: AppHandle,  // 新增参数
) -> Result<crate::task_database::Task, String> {
    // ... 创建任务逻辑 ...

    // 发送事件
    let _ = app.emit_all("task-created", serde_json::json!({
        "taskId": task.id,
        "name": task.name,
    }));

    Ok(task)
}
```

### Phase 2: 前端事件监听

#### 2.1 创建事件服务

**文件**: `src/services/events/taskEvents.ts`

```typescript
import { listen, UnlistenFn } from '@tauri-apps/api/event'

export interface TaskExecutedPayload {
  taskId: string
  status: 'success' | 'failed'
  duration: number
  timestamp: string
}

export interface TaskCreatedPayload {
  taskId: string
  name: string
}

export class TaskEventService {
  private unlisteners: UnlistenFn[] = []

  async onTaskExecuted(callback: (payload: TaskExecutedPayload) => void): Promise<void> {
    const unlisten = await listen<TaskExecutedPayload>('task-executed', (event) => {
      callback(event.payload)
    })
    this.unlisteners.push(unlisten)
  }

  async onTaskCreated(callback: (payload: TaskCreatedPayload) => void): Promise<void> {
    const unlisten = await listen<TaskCreatedPayload>('task-created', (event) => {
      callback(event.payload)
    })
    this.unlisteners.push(unlisten)
  }

  async onTaskUpdated(callback: (payload: { taskId: string }) => void): Promise<void> {
    const unlisten = await listen('task-updated', (event) => {
      callback(event.payload as any)
    })
    this.unlisteners.push(unlisten)
  }

  async onTaskDeleted(callback: (payload: { taskId: string }) => void): Promise<void> {
    const unlisten = await listen('task-deleted', (event) => {
      callback(event.payload as any)
    })
    this.unlisteners.push(unlisten)
  }

  cleanup(): void {
    this.unlisteners.forEach(unlisten => unlisten())
    this.unlisteners = []
  }
}

export const taskEventService = new TaskEventService()
```

#### 2.2 在任务详情页面监听事件

**文件**: `src/components/TaskDetailPane.tsx` (或相应的任务详情组件)

```typescript
import { useEffect } from 'react'
import { taskEventService } from '@/services/events/taskEvents'
import { taskService } from '@/services/task'

export function TaskDetailPane({ taskId }: { taskId: string }) {
  const [taskDetail, setTaskDetail] = useState(null)

  // 加载任务详情
  const loadTaskDetail = async () => {
    const detail = await taskService.getTaskDetail(taskId)
    setTaskDetail(detail)
  }

  useEffect(() => {
    loadTaskDetail()

    // 监听任务执行事件
    taskEventService.onTaskExecuted((payload) => {
      if (payload.taskId === taskId) {
        console.log('Task executed, refreshing...', payload)
        loadTaskDetail()  // 自动刷新
      }
    })

    return () => {
      taskEventService.cleanup()
    }
  }, [taskId])

  // ... 渲染逻辑 ...
}
```

#### 2.3 在任务列表页面监听事件

**文件**: `src/components/TaskList.tsx` (或相应的任务列表组件)

```typescript
import { useEffect } from 'react'
import { taskEventService } from '@/services/events/taskEvents'
import { taskService } from '@/services/task'

export function TaskList() {
  const [tasks, setTasks] = useState([])

  const loadTasks = async () => {
    const taskList = await taskService.getTasks()
    setTasks(taskList)
  }

  useEffect(() => {
    loadTasks()

    // 监听所有任务事件
    taskEventService.onTaskExecuted(() => {
      loadTasks()  // 任务执行后刷新列表
    })

    taskEventService.onTaskCreated(() => {
      loadTasks()  // 创建任务后刷新列表
    })

    taskEventService.onTaskUpdated(() => {
      loadTasks()  // 更新任务后刷新列表
    })

    taskEventService.onTaskDeleted(() => {
      loadTasks()  // 删除任务后刷新列表
    })

    return () => {
      taskEventService.cleanup()
    }
  }, [])

  // ... 渲染逻辑 ...
}
```

### Phase 3: 优化和防抖

#### 3.1 防止频繁刷新

如果多个任务同时执行，可能会触发多次刷新。使用防抖优化：

```typescript
import { debounce } from 'lodash-es'

export function TaskList() {
  const [tasks, setTasks] = useState([])

  const loadTasks = async () => {
    const taskList = await taskService.getTasks()
    setTasks(taskList)
  }

  // 防抖：500ms 内只刷新一次
  const debouncedLoadTasks = debounce(loadTasks, 500)

  useEffect(() => {
    loadTasks()

    taskEventService.onTaskExecuted(() => {
      debouncedLoadTasks()
    })

    return () => {
      taskEventService.cleanup()
      debouncedLoadTasks.cancel()
    }
  }, [])

  // ... 渲染逻辑 ...
}
```

#### 3.2 增量更新（可选）

对于任务详情页面，可以只更新变化的部分，而不是重新加载整个数据：

```typescript
taskEventService.onTaskExecuted((payload) => {
  if (payload.taskId === taskId) {
    // 只更新执行统计，不重新加载整个任务
    setTaskDetail(prev => ({
      ...prev,
      statistics: {
        ...prev.statistics,
        totalExecutions: prev.statistics.totalExecutions + 1,
        successCount: payload.status === 'success' 
          ? prev.statistics.successCount + 1 
          : prev.statistics.successCount,
        failureCount: payload.status === 'failed'
          ? prev.statistics.failureCount + 1
          : prev.statistics.failureCount,
      },
      lastExecution: {
        status: payload.status,
        duration: payload.duration,
        timestamp: payload.timestamp,
      }
    }))
  }
})
```

## 四、测试计划

### 4.1 单元测试

- 测试事件发送逻辑（后端）
- 测试事件监听逻辑（前端）

### 4.2 集成测试

1. 创建一个 2 分钟间隔的定时任务
2. 保持任务详情页面打开
3. 等待任务执行
4. 验证页面自动刷新，显示最新的执行记录

### 4.3 性能测试

- 测试多个任务同时执行时的事件处理性能
- 验证防抖机制是否有效

## 五、注意事项

### 5.1 AppHandle 的生命周期

`AppHandle` 需要在应用启动时获取并传递给需要发送事件的组件。确保：
- 在 `main.rs` 中正确初始化
- 在 `WorkspaceContext` 中正确传递
- 在 `PythonScriptExecutor` 中正确存储

### 5.2 事件命名规范

使用 kebab-case 命名事件，保持一致性：
- `task-executed`
- `task-created`
- `task-updated`
- `task-deleted`

### 5.3 错误处理

事件发送失败不应影响主要业务逻辑：
```rust
let _ = app.emit_all("task-executed", payload);  // 使用 let _ 忽略错误
```

### 5.4 内存泄漏防护

前端组件卸载时必须清理事件监听器：
```typescript
useEffect(() => {
  // ... 注册监听器 ...
  
  return () => {
    taskEventService.cleanup()  // 清理
  }
}, [])
```

## 六、实施优先级

### 高优先级
- Phase 1.1-1.3: 后端事件发送（任务执行完成）
- Phase 2.1-2.2: 前端事件监听（任务详情页面）

### 中优先级
- Phase 1.4: 其他任务操作事件
- Phase 2.3: 任务列表页面监听

### 低优先级
- Phase 3: 优化和防抖

## 七、后续优化

1. **WebSocket 支持**: 如果需要更实时的通信，可以考虑使用 WebSocket
2. **事件队列**: 对于高频事件，可以实现事件队列和批量处理
3. **离线支持**: 当应用在后台时，缓存事件并在前台恢复时批量处理

---

**文档状态**: 设计方案，待实现
