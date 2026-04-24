use tauri::{AppHandle, State};
use std::sync::Mutex;
use crate::task_database::{TaskDatabase, TaskConfigInput, ExecutionResult, Task};
use crate::task_executor::TaskExecutor;
use crate::unified_timer::{UnifiedTimerManager, Timer, TimerType, PythonScriptExecutor, LocalBridgeSyncExecutor};

use std::sync::Arc;

// WorkspaceContext encapsulates all workspace-specific resources
pub struct WorkspaceContext {
    pub db: Arc<Mutex<TaskDatabase>>,
    pub executor: Arc<TaskExecutor>,
    pub timer_manager: UnifiedTimerManager,
    pub workspace_path: String,
    pub app_handle: AppHandle,
}

impl WorkspaceContext {
    pub fn new(workspace_path: String, app_handle: AppHandle) -> Result<Self, String> {
        log::info!("[WorkspaceContext] Creating new workspace context for: {}", workspace_path);

        let db_path = std::path::Path::new(&workspace_path)
            .join(".tweetpilot/tweetpilot.db");

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let db = TaskDatabase::new(db_path).map_err(|e| e.to_string())?;

        log::info!("[WorkspaceContext] Recalculating next execution times after database initialization...");
        db.recalculate_missed_executions().map_err(|e| {
            log::error!("[WorkspaceContext] Failed to recalculate missed executions: {}", e);
            e.to_string()
        })?;

        let executor = Arc::new(TaskExecutor::new());
        let timer_manager = UnifiedTimerManager::new(Some(app_handle.clone()));

        log::info!("[WorkspaceContext] Workspace context created successfully");

        Ok(Self {
            db: Arc::new(Mutex::new(db)),
            executor,
            timer_manager,
            workspace_path,
            app_handle,
        })
    }

    pub async fn start_timers(&self) -> Result<(), String> {
        log::info!("[WorkspaceContext] Starting timers for workspace: {}", self.workspace_path);

        self.timer_manager.start().await;

        log::info!("[WorkspaceContext] Registering LocalBridge sync executor");
        self.timer_manager.register_executor(
            "localbridge_sync".to_string(),
            Arc::new(LocalBridgeSyncExecutor::new(self.db.clone(), Some(self.app_handle.clone()))),
        ).await;

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

        log::info!("[WorkspaceContext] Registering python_script executor");
        self.timer_manager.register_executor(
            "python_script".to_string(),
            Arc::new(PythonScriptExecutor::new(self.workspace_path.clone(), self.db.clone())),
        ).await;

        let tasks = {
            let db = self.db.lock().map_err(|e| e.to_string())?;
            db.get_all_tasks().map_err(|e| e.to_string())?
        };
        log::info!("[WorkspaceContext] Loading {} tasks from database", tasks.len());

        let mut registered_count = 0;
        for task in tasks {
            if !task.enabled || task.task_type != "scheduled" {
                continue;
            }

            match Self::build_task_timer(&task) {
                Ok(Some(timer)) => {
                    log::info!("[WorkspaceContext] Registering timer for task: {} ({})", task.name, task.id);
                    self.timer_manager.register_timer(timer).await?;
                    registered_count += 1;
                }
                Ok(None) => {
                    log::warn!("[WorkspaceContext] Failed to build timer for task: {} (invalid config)", task.name);
                }
                Err(e) => {
                    log::error!("[WorkspaceContext] Error building timer for task {}: {}", task.name, e);
                }
            }
        }

        log::info!("[WorkspaceContext] Successfully registered {} task timers", registered_count);
        Ok(())
    }

    fn build_task_timer(task: &Task) -> Result<Option<Timer>, String> {
        let timer_type = match task.schedule_type.as_str() {
            "interval" => {
                if let Some(interval_secs) = task.interval_seconds {
                    TimerType::Interval { seconds: interval_secs as u64 }
                } else {
                    return Ok(None);
                }
            }
            "cron" => {
                if let Some(ref schedule) = task.schedule {
                    TimerType::Cron { expression: schedule.clone() }
                } else {
                    return Ok(None);
                }
            }
            _ => return Ok(None),
        };

        Ok(Some(Timer {
            id: format!("task-{}", task.id),
            name: task.name.clone(),
            timer_type,
            enabled: true,
            priority: 50,
            next_execution: task.next_execution_time.as_ref()
                .and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
                .map(|t| t.with_timezone(&chrono::Utc)),
            last_execution: task.last_execution_time.as_ref()
                .and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
                .map(|t| t.with_timezone(&chrono::Utc)),
            executor: "python_script".to_string(),
            executor_config: serde_json::json!({
                "script_path": task.script_path,
                "timeout": task.timeout.unwrap_or(300),
            }),
        }))
    }
}

impl Drop for WorkspaceContext {
    fn drop(&mut self) {
        log::info!("[WorkspaceContext] Dropping workspace context for: {}", self.workspace_path);
    }
}

// TaskState now only holds the workspace context
pub struct TaskState {
    pub workspace_context: Arc<tokio::sync::Mutex<Option<WorkspaceContext>>>,
}

impl TaskState {
    pub fn new() -> Self {
        Self {
            workspace_context: Arc::new(tokio::sync::Mutex::new(None)),
        }
    }

    pub async fn get_context(&self) -> tokio::sync::MutexGuard<'_, Option<WorkspaceContext>> {
        self.workspace_context.lock().await
    }
}

#[tauri::command]
pub async fn execute_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<ExecutionResult, String> {
    println!("🚀 execute_task called with task_id: {}", task_id);

    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let task = ctx.db.lock().unwrap().get_task(&task_id).map_err(|e| e.to_string())?;

    println!("📋 Task retrieved: type={}, status={}", task.task_type, task.status);

    if task.status == "running" {
        return Err("Task is already running".to_string());
    }

    ctx.db.lock().unwrap().update_task_status(&task_id, "running").map_err(|e| e.to_string())?;

    let result = ctx.executor.execute_task(&task, &ctx.workspace_path).await;

    log::info!("[execute_task] Task execution returned, processing result");

    match result {
        Ok(exec_result) => {
            log::info!("[execute_task] Execution successful, saving to database");
            ctx.db.lock().unwrap().save_execution(&exec_result).map_err(|e| e.to_string())?;
            log::info!("[execute_task] Updating task status to idle");
            ctx.db.lock().unwrap().update_task_status(&task_id, "idle").map_err(|e| e.to_string())?;

            if task.task_type == "scheduled" && exec_result.status == "success" {
                log::info!("[execute_task] Task is scheduled, updating next execution time");
                let updated_task = ctx.db.lock().unwrap().get_task(&task_id);
                match updated_task {
                    Ok(updated_task) => {
                        log::info!("[execute_task] Re-fetched task, calling update_next_execution_time");
                        match ctx.db.lock().unwrap().update_next_execution_time(&task_id, &updated_task) {
                            Ok(_) => {
                                log::info!("[execute_task] Successfully updated next execution time");
                            }
                            Err(e) => {
                                log::error!("[execute_task] Failed to update next execution time: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("[execute_task] Failed to re-fetch task: {}", e);
                    }
                }
            }

            log::info!("[execute_task] Returning execution result to frontend");
            crate::app_events::publish_task_executed(&ctx.app_handle, task_id.clone(), exec_result.status.clone());
            Ok(exec_result)
        }
        Err(e) => {
            log::error!("[execute_task] Execution failed: {}", e);
            ctx.db.lock().unwrap().update_task_status(&task_id, "failed").map_err(|e| e.to_string())?;
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn get_tasks(state: State<'_, TaskState>) -> Result<Vec<crate::task_database::Task>, String> {
    log::info!("[get_tasks] Command called");
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    log::info!("[get_tasks] Database acquired, fetching tasks");
    let tasks = ctx.db.lock().unwrap().get_all_tasks().map_err(|e| e.to_string())?;
    log::info!("[get_tasks] Fetched {} tasks", tasks.len());
    Ok(tasks)
}

#[tauri::command]
pub async fn get_task_detail(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<serde_json::Value, String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let task = ctx.db.lock().unwrap().get_task(&task_id).map_err(|e| e.to_string())?;
    let history = ctx.db.lock().unwrap().get_execution_history(&task_id, Some(50)).map_err(|e| e.to_string())?;

    // Get last execution for the task
    let last_execution = history.first().map(|exec| {
        serde_json::json!({
            "id": exec.id,
            "taskId": exec.task_id,
            "startTime": exec.start_time,
            "endTime": exec.end_time,
            "duration": exec.duration,
            "status": exec.status,
            "exitCode": exec.exit_code,
            "output": exec.stdout,
            "error": exec.stderr,
        })
    });

    // Calculate statistics
    let statistics = serde_json::json!({
        "totalExecutions": task.total_executions,
        "successCount": task.success_count,
        "failureCount": task.failure_count,
        "successRate": if task.total_executions > 0 {
            (task.success_count as f64 / task.total_executions as f64 * 100.0).round()
        } else {
            0.0
        },
        "averageDuration": task.average_duration,
    });

    let mut task_json = serde_json::to_value(&task).map_err(|e| e.to_string())?;

    if let Some(obj) = task_json.as_object_mut() {
        obj.insert("lastExecution".to_string(), last_execution.unwrap_or(serde_json::Value::Null));
    }

    Ok(serde_json::json!({
        "task": task_json,
        "statistics": statistics,
        "history": history,
    }))
}

#[tauri::command]
pub async fn create_task(
    config: TaskConfigInput,
    state: State<'_, TaskState>,
) -> Result<crate::task_database::Task, String> {
    log::info!("[create_task] Command called with task name: {}", config.name);

    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    log::info!("[create_task] Creating task in database");
    let task = ctx.db.lock().unwrap().create_task(config).map_err(|e| {
        log::error!("[create_task] Database create_task failed: {}", e);
        e.to_string()
    })?;

    log::info!("[create_task] Task created with ID: {}", task.id);

    // Register the new task timer if it's a scheduled task
    if task.enabled && task.task_type == "scheduled" {
        match WorkspaceContext::build_task_timer(&task) {
            Ok(Some(timer)) => {
                log::info!("[create_task] Registering timer for new task: {}", task.name);
                ctx.timer_manager.register_timer(timer).await?;
            }
            Ok(None) => {
                log::warn!("[create_task] Failed to build timer for task: {} (invalid config)", task.name);
            }
            Err(e) => {
                log::error!("[create_task] Error building timer for task {}: {}", task.name, e);
            }
        }
    }

    log::info!("[create_task] Task creation completed successfully");
    crate::app_events::publish_task_created(&ctx.app_handle, task.id.clone());
    Ok(task)
}

#[tauri::command]
pub async fn update_task(
    task_id: String,
    config: TaskConfigInput,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    ctx.db.lock().unwrap().update_task(&task_id, config).map_err(|e| e.to_string())?;

    // Clear all task timers and reload
    ctx.timer_manager.clear_task_timers().await;

    // Reload all task timers
    let tasks = ctx.db.lock().unwrap().get_all_tasks().map_err(|e| e.to_string())?;
    for task in tasks {
        if !task.enabled || task.task_type != "scheduled" {
            continue;
        }
        match WorkspaceContext::build_task_timer(&task) {
            Ok(Some(timer)) => {
                ctx.timer_manager.register_timer(timer).await?;
            }
            Ok(None) => {
                log::warn!("[update_task] Failed to build timer for task: {}", task.name);
            }
            Err(e) => {
                log::error!("[update_task] Error building timer for task {}: {}", task.name, e);
            }
        }
    }

    crate::app_events::publish_task_updated(&ctx.app_handle, task_id.clone());
    Ok(())
}

#[tauri::command]
pub async fn delete_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    ctx.db.lock().unwrap().delete_task(&task_id).map_err(|e| e.to_string())?;

    // Unregister the timer for this task
    let mut registry = ctx.timer_manager.registry.lock().await;
    let _ = registry.unregister(&format!("task-{}", task_id));
    drop(registry);

    crate::app_events::publish_task_deleted(&ctx.app_handle, task_id.clone());
    Ok(())
}

#[tauri::command]
pub async fn pause_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    ctx.db.lock().unwrap().update_task_status(&task_id, "paused").map_err(|e| e.to_string())?;

    // Unregister the timer for this task
    let mut registry = ctx.timer_manager.registry.lock().await;
    let _ = registry.unregister(&format!("task-{}", task_id));
    drop(registry);

    crate::app_events::publish_task_paused(&ctx.app_handle, task_id.clone());
    Ok(())
}

#[tauri::command]
pub async fn resume_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    ctx.db.lock().unwrap().update_task_status(&task_id, "idle").map_err(|e| e.to_string())?;

    // Re-register the timer for this task
    let task = ctx.db.lock().unwrap().get_task(&task_id).map_err(|e| e.to_string())?;
    if task.enabled && task.task_type == "scheduled" {
        match WorkspaceContext::build_task_timer(&task) {
            Ok(Some(timer)) => {
                ctx.timer_manager.register_timer(timer).await?;
            }
            Ok(None) => {
                log::warn!("[resume_task] Failed to build timer for task: {}", task.name);
            }
            Err(e) => {
                log::error!("[resume_task] Error building timer for task {}: {}", task.name, e);
            }
        }
    }

    crate::app_events::publish_task_resumed(&ctx.app_handle, task_id.clone());
    Ok(())
}

#[tauri::command]
pub async fn get_execution_history(
    task_id: String,
    limit: Option<i64>,
    state: State<'_, TaskState>,
) -> Result<Vec<ExecutionResult>, String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let result = ctx.db.lock().unwrap().get_execution_history(&task_id, limit).map_err(|e| e.to_string())?;
    Ok(result)
}

#[tauri::command]
pub async fn get_timer_system_status(
    state: State<'_, TaskState>,
) -> Result<serde_json::Value, String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let status = ctx.timer_manager.get_status().await;
    serde_json::to_value(status).map_err(|e| e.to_string())
}
