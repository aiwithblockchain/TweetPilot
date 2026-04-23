# 工作区定时器隔离重构方案

## 版本信息
- **版本**: v1.0
- **创建时间**: 2026-04-22
- **目标**: 实现工作区级别的定时器隔离

## 问题分析

### 当前架构问题

```rust
// 当前：全局单例，所有工作区共享
pub struct TaskState {
    pub db: Arc<Mutex<Option<TaskDatabase>>>,
    pub executor: Arc<TaskExecutor>,
    pub workspace_root: Arc<Mutex<String>>,
    pub timer_manager: Arc<UnifiedTimerManager>,  // ❌ 全局共享
}
```

**存在的问题：**
1. `UnifiedTimerManager` 是全局单例，所有工作区共享同一个实例
2. 切换工作区时，旧工作区的定时器被清除，无法保持独立运行
3. 定时器与工作区没有绑定关系，数据库和定时器可能不匹配
4. 多窗口场景下，不同工作区的定时器会互相干扰

## 设计目标

1. **一个工作区 = 一个 UnifiedTimerManager 实例**
2. **工作区切换时，旧的 UnifiedTimerManager 完全释放**
3. **定时任务数据只存储在对应工作区的数据库中**
4. **多窗口支持：每个窗口独立管理自己的工作区和定时器**

## 重构方案

### 1. 新增 WorkspaceContext 结构

```rust
// src-tauri/src/task_commands.rs

pub struct WorkspaceContext {
    pub db: TaskDatabase,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
}

impl WorkspaceContext {
    pub fn new(workspace_path: String) -> Result<Self, String> {
        let db_path = std::path::Path::new(&workspace_path)
            .join(".tweetpilot/tweetpilot.db");

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let db = TaskDatabase::new(db_path).map_err(|e| e.to_string())?;
        let executor = Arc::new(TaskExecutor::new());
        let timer_manager = UnifiedTimerManager::new();

        Ok(Self {
            db,
            executor,
            timer_manager,
            workspace_path,
        })
    }

    pub async fn start_timers(&self) -> Result<(), String> {
        // 启动事件循环
        self.timer_manager.start().await;

        // 注册 LocalBridge executor
        self.timer_manager.register_executor(
            "localbridge_sync".to_string(),
            Arc::new(LocalBridgeSyncExecutor::new(/* db reference */)),
        ).await;

        // 注册 LocalBridge 定时器
        let localbridge_timer = Timer {
            id: "system-localbridge-sync".to_string(),
            name: "System LocalBridge Sync".to_string(),
            timer_type: TimerType::Interval { seconds: 60 },
            enabled: true,
            priority: 100,
            next_execution: Some(chrono::Utc::now()),
            last_execution: None,
            executor: "localbridge_sync".to_string(),
            executor_config: serde_json::json!({}),
        };

        self.timer_manager.register_timer(localbridge_timer).await?;

        // 注册 python_script executor
        self.timer_manager.register_executor(
            "python_script".to_string(),
            Arc::new(PythonScriptExecutor::new(
                self.workspace_path.clone(),
                /* db reference */
            )),
        ).await;

        // 从数据库加载工作区的定时任务
        let tasks = self.db.get_all_tasks().map_err(|e| e.to_string())?;
        for task in tasks {
            if !task.enabled {
                continue;
            }

            if task.task_type != "scheduled" {
                continue;
            }

            match Self::build_task_timer(&task) {
                Ok(Some(timer)) => {
                    self.timer_manager.register_timer(timer).await?;
                }
                Ok(None) => {
                    log::warn!("Failed to build timer for task: {}", task.name);
                }
                Err(e) => {
                    log::error!("Error building timer for task {}: {}", task.name, e);
                }
            }
        }

        Ok(())
    }

    fn build_task_timer(task: &Task) -> Result<Option<Timer>, String> {
        // 从 task_commands.rs 中复制现有的 build_task_timer 逻辑
        // ...
    }
}

impl Drop for WorkspaceContext {
    fn drop(&mut self) {
        log::info!("[WorkspaceContext] Dropping workspace context for: {}", self.workspace_path);
        // UnifiedTimerManager 会在 drop 时自动停止所有定时器
    }
}
```

### 2. 修改 TaskState 结构

```rust
// src-tauri/src/task_commands.rs

pub struct TaskState {
    pub workspace_context: Arc<Mutex<Option<WorkspaceContext>>>,
}

impl TaskState {
    pub fn new() -> Self {
        Self {
            workspace_context: Arc::new(Mutex::new(None)),
        }
    }

    pub fn get_context(&self) -> Result<std::sync::MutexGuard<'_, Option<WorkspaceContext>>, String> {
        self.workspace_context.lock().map_err(|e| {
            log::error!("[TaskState] Failed to acquire workspace context lock: {}", e);
            e.to_string()
        })
    }
}
```

### 3. 重构 set_current_workspace

```rust
// src-tauri/src/commands/workspace.rs

#[tauri::command]
pub async fn set_current_workspace(
    path: String,
    task_state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String> {
    log::info!("[set_current_workspace] Starting workspace switch to: {}", path);

    if path.trim().is_empty() {
        return Err("工作目录不能为空".to_string());
    }

    let workspace_path = Path::new(&path);
    let marker_file = workspace_path.join(".tweetpilot.json");

    if !marker_file.exists() {
        log::info!("[set_current_workspace] Marker file not found, initializing workspace");
        initialize_workspace(path.clone()).await?;
    }

    // Step 1: 释放旧工作区（如果存在）
    {
        let mut workspace_ctx = task_state.get_context()?;
        if let Some(old_ctx) = workspace_ctx.take() {
            log::info!("[set_current_workspace] Releasing old workspace context");
            // WorkspaceContext 会在 drop 时自动停止所有定时器
            drop(old_ctx);
        }
    }

    // Step 2: 创建新工作区上下文
    log::info!("[set_current_workspace] Creating new workspace context");
    let new_ctx = crate::task_commands::WorkspaceContext::new(path.clone())?;

    // Step 3: 启动定时器系统
    log::info!("[set_current_workspace] Starting timers for new workspace");
    new_ctx.start_timers().await?;

    // Step 4: 保存新工作区上下文
    {
        let mut workspace_ctx = task_state.get_context()?;
        *workspace_ctx = Some(new_ctx);
    }

    // Step 5: 持久化工作区配置
    log::info!("[set_current_workspace] Persisting workspace config");
    persist_current_workspace(path)
}
```

### 4. 更新所有 Tauri 命令

所有需要访问数据库、executor 或 timer_manager 的命令都需要更新：

```rust
#[tauri::command]
pub async fn execute_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<ExecutionResult, String> {
    let workspace_ctx = state.get_context()?;
    let ctx = workspace_ctx.as_ref()
        .ok_or("No workspace selected")?;

    let task = ctx.db.get_task(&task_id).map_err(|e| e.to_string())?;

    if task.status == "running" {
        return Err("Task is already running".to_string());
    }

    ctx.db.update_task_status(&task_id, "running").map_err(|e| e.to_string())?;

    let result = ctx.executor.execute_task(&task, &ctx.workspace_path).await;

    match result {
        Ok(exec_result) => {
            ctx.db.save_execution(&exec_result).map_err(|e| e.to_string())?;
            ctx.db.update_task_status(&task_id, "idle").map_err(|e| e.to_string())?;

            if task.task_type == "scheduled" && exec_result.status == "success" {
                match ctx.db.get_task(&task_id) {
                    Ok(updated_task) => {
                        let _ = ctx.db.update_next_execution_time(&task_id, &updated_task);
                    }
                    Err(e) => {
                        log::error!("Failed to re-fetch task: {:?}", e);
                    }
                }
            }

            Ok(exec_result)
        }
        Err(e) => {
            ctx.db.update_task_status(&task_id, "failed").map_err(|e| e.to_string())?;
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn get_tasks(state: State<'_, TaskState>) -> Result<Vec<Task>, String> {
    let workspace_ctx = state.get_context()?;
    let ctx = workspace_ctx.as_ref()
        .ok_or("No workspace selected")?;

    ctx.db.get_all_tasks().map_err(|e| e.to_string())
}

// 类似地更新其他所有命令...
```

### 5. 为 UnifiedTimerManager 实现 Drop trait

```rust
// src-tauri/src/unified_timer/mod.rs

impl Drop for UnifiedTimerManager {
    fn drop(&mut self) {
        log::info!("[UnifiedTimerManager] Dropping timer manager, stopping all timers");
        // 注意：由于 drop 是同步的，我们需要使用 block_on 来等待异步操作
        // 或者在 WorkspaceContext 的 drop 中处理停止逻辑
    }
}
```

### 6. 修改 main.rs 初始化逻辑

```rust
// src-tauri/src/main.rs

fn main() {
    // ... 日志初始化 ...

    // 创建 TaskState（不再预先创建 timer_manager）
    let task_state = TaskState::new();

    // 创建 AI state
    let ai_state = ai::AiState {
        session: Arc::new(tokio::sync::Mutex::new(None)),
        cancel_token: Arc::new(tokio::sync::Mutex::new(None)),
        active_request_id: Arc::new(tokio::sync::Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(task_state)
        .manage(ai_state)
        .setup(move |app| {
            // 不再在这里启动 timer_manager
            // timer_manager 会在 set_current_workspace 时创建和启动
            
            // ... 菜单设置 ...
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ... 所有命令 ...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 需要更新的命令列表

以下命令需要从 `TaskState` 中获取 `WorkspaceContext`：

1. `execute_task` - 执行任务
2. `get_tasks` - 获取任务列表
3. `get_task_detail` - 获取任务详情
4. `create_task` - 创建任务
5. `update_task` - 更新任务
6. `delete_task` - 删除任务
7. `pause_task` - 暂停任务
8. `resume_task` - 恢复任务
9. `get_execution_history` - 获取执行历史
10. `get_timer_system_status` - 获取定时器系统状态

## 实施步骤

1. **Phase 1: 创建 WorkspaceContext 结构**
   - 在 `task_commands.rs` 中定义 `WorkspaceContext`
   - 实现 `new()` 和 `start_timers()` 方法
   - 实现 `Drop` trait

2. **Phase 2: 修改 TaskState**
   - 将 `TaskState` 改为只包含 `workspace_context`
   - 实现 `get_context()` 辅助方法

3. **Phase 3: 重构 set_current_workspace**
   - 实现工作区切换逻辑
   - 确保旧工作区正确释放
   - 确保新工作区正确初始化

4. **Phase 4: 更新所有 Tauri 命令**
   - 逐个更新命令以使用 `WorkspaceContext`
   - 确保错误处理正确

5. **Phase 5: 修改 main.rs**
   - 移除全局 timer_manager 初始化
   - 简化启动逻辑

6. **Phase 6: 测试**
   - 测试工作区切换
   - 测试定时器隔离
   - 测试多窗口场景

## 优势

1. **完全隔离**：每个工作区的定时器互不干扰
2. **自动清理**：切换工作区时，旧的 UnifiedTimerManager 自动释放
3. **数据一致性**：定时任务只存储在对应工作区的数据库中
4. **多窗口支持**：每个窗口独立管理自己的工作区
5. **资源管理**：不再使用的工作区资源会被正确释放

## 风险评估

**低风险：**
- 创建新的 `WorkspaceContext` 结构
- 修改 `TaskState` 结构

**中风险：**
- 重构 `set_current_workspace` 逻辑
- 更新所有 Tauri 命令

**高风险：**
- `UnifiedTimerManager` 的生命周期管理
- 确保所有资源正确释放

## 测试计划

1. **单工作区测试**
   - 选择工作区
   - 创建定时任务
   - 验证定时器正常运行
   - 切换到另一个工作区
   - 验证旧工作区定时器已停止
   - 验证新工作区定时器正常运行

2. **多窗口测试**
   - 打开两个应用窗口
   - 每个窗口选择不同的工作区
   - 验证两个工作区的定时器独立运行
   - 验证数据库隔离

3. **资源释放测试**
   - 监控内存使用
   - 多次切换工作区
   - 验证没有内存泄漏

## 注意事项

1. **LocalBridgeSyncExecutor 需要数据库引用**
   - 当前实现中，`LocalBridgeSyncExecutor` 需要 `Arc<Mutex<Option<TaskDatabase>>>`
   - 重构后需要改为直接引用 `TaskDatabase`

2. **PythonScriptExecutor 需要数据库引用**
   - 同样需要调整数据库引用方式

3. **异步 Drop 问题**
   - Rust 的 `Drop` trait 是同步的
   - 需要在 `WorkspaceContext` 的 `drop` 中处理异步清理
   - 可能需要使用 `tokio::runtime::Handle::current().block_on()`

4. **错误处理**
   - 所有命令都需要处理 "No workspace selected" 错误
   - 需要友好的错误提示

## 后续优化

1. **工作区预加载**
   - 可以考虑在应用启动时加载上次使用的工作区

2. **工作区缓存**
   - 如果需要频繁切换工作区，可以考虑缓存最近使用的工作区上下文

3. **优雅关闭**
   - 应用关闭时，确保所有定时器正确停止
   - 确保所有数据库连接正确关闭
