use tauri::State;
use std::sync::Mutex;
use crate::task_database::{TaskDatabase, TaskConfigInput, ExecutionResult, Task};
use crate::task_executor::TaskExecutor;
use crate::unified_timer::{UnifiedTimerManager, Timer, TimerType, PythonScriptExecutor};

use std::sync::Arc;

pub struct TaskState {
    pub db: Arc<Mutex<Option<TaskDatabase>>>,
    pub executor: Arc<TaskExecutor>,
    pub workspace_root: Arc<Mutex<String>>,
    pub timer_manager: Arc<UnifiedTimerManager>,
}

impl TaskState {
    pub fn init_database(&self, workspace_path: &str) -> Result<(), String> {
        let db_path = std::path::Path::new(workspace_path).join(".tweetpilot/tasks.db");

        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let task_db = TaskDatabase::new(db_path).map_err(|e| e.to_string())?;

        eprintln!("🔄 Recalculating next execution times after database initialization...");
        task_db.recalculate_missed_executions().map_err(|e| {
            eprintln!("❌ Failed to recalculate missed executions: {}", e);
            e.to_string()
        })?;

        let mut db = self.db.lock().map_err(|e| e.to_string())?;
        *db = Some(task_db);
        Ok(())
    }

    fn get_db(&self) -> Result<std::sync::MutexGuard<'_, Option<TaskDatabase>>, String> {
        log::debug!("[get_db] Acquiring database lock");
        let db = self.db.lock().map_err(|e| {
            log::error!("[get_db] Failed to acquire lock: {}", e);
            e.to_string()
        })?;

        if db.is_none() {
            log::warn!("[get_db] Database is None - not initialized");
            return Err("数据库未初始化，请先选择工作区".to_string());
        }

        log::debug!("[get_db] Database acquired successfully");
        Ok(db)
    }

    pub async fn reload_unified_timers(&self) -> Result<(), String> {
        log::info!("[reload_unified_timers] Starting timer reload");

        let workspace_root = self.workspace_root.lock().map_err(|e| e.to_string())?.clone();
        if workspace_root.is_empty() {
            log::warn!("[reload_unified_timers] Workspace root is empty, skipping");
            return Ok(());
        }
        log::info!("[reload_unified_timers] Workspace root: {}", workspace_root);

        let tasks = {
            let db = self.get_db()?;
            let all_tasks = db.as_ref().unwrap().get_all_tasks().map_err(|e| e.to_string())?;
            log::info!("[reload_unified_timers] Loaded {} tasks from database", all_tasks.len());
            all_tasks
        };

        log::info!("[reload_unified_timers] Clearing old task timers");
        self.timer_manager.clear_task_timers().await;

        log::info!("[reload_unified_timers] Registering python_script executor");
        self.timer_manager.register_executor(
            "python_script".to_string(),
            Arc::new(PythonScriptExecutor::new(workspace_root, self.db.clone()))
        ).await;

        let mut registered_count = 0;
        for task in tasks {
            if !task.enabled {
                log::debug!("[reload_unified_timers] Skipping disabled task: {}", task.name);
                continue;
            }

            if task.task_type != "scheduled" {
                log::debug!("[reload_unified_timers] Skipping non-scheduled task: {}", task.name);
                continue;
            }

            match Self::build_task_timer(&task) {
                Ok(Some(timer)) => {
                    log::info!("[reload_unified_timers] Registering timer for task: {} ({})", task.name, task.id);
                    self.timer_manager.register_timer(timer).await?;
                    registered_count += 1;
                }
                Ok(None) => {
                    log::warn!("[reload_unified_timers] Failed to build timer for task: {} (invalid config)", task.name);
                }
                Err(e) => {
                    log::error!("[reload_unified_timers] Error building timer for task {}: {}", task.name, e);
                    return Err(e);
                }
            }
        }

        log::info!("[reload_unified_timers] Successfully registered {} timers", registered_count);
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
                "account_id": task.account_id,
                "parameters": serde_json::from_str::<serde_json::Value>(&task.parameters).unwrap_or(serde_json::json!({})),
                "timeout": task.timeout.unwrap_or(300),
            }),
        }))
    }
}

#[tauri::command]
pub async fn execute_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<ExecutionResult, String> {
    println!("🚀 execute_task called with task_id: {}", task_id);

    // Get task
    let task = {
        let db = state.get_db()?;
        db.as_ref().unwrap().get_task(&task_id).map_err(|e| e.to_string())?
    };

    println!("📋 Task retrieved: type={}, status={}", task.task_type, task.status);

    // Check if task is already running
    if task.status == "running" {
        return Err("Task is already running".to_string());
    }

    // Update status to running
    {
        let db = state.get_db()?;
        db.as_ref().unwrap().update_task_status(&task_id, "running").map_err(|e| e.to_string())?;
    }

    // Get workspace root
    let workspace_root = state.workspace_root.lock().map_err(|e| e.to_string())?.clone();

    // Execute task
    let result = state.executor.execute_task(&task, &workspace_root).await;

    // Save result and update status
    match result {
        Ok(exec_result) => {
            let db = state.get_db()?;
            let db_ref = db.as_ref().unwrap();
            db_ref.save_execution(&exec_result).map_err(|e| e.to_string())?;

            // Write debug info to file
            use std::io::Write;
            let mut file = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open("/tmp/tweetpilot_debug.log")
                .unwrap();
            writeln!(file, "task_type={}, exec_result.status={}", task.task_type, exec_result.status).unwrap();

            // IMPORTANT: Update status to idle FIRST, before updating next_execution_time
            // This ensures the task status is always updated even if next_execution_time calculation fails
            db_ref.update_task_status(&task_id, "idle").map_err(|e| e.to_string())?;

            // Update next_execution_time for scheduled tasks if execution was successful
            if task.task_type == "scheduled" && exec_result.status == "success" {
                writeln!(file, "Calling update_next_execution_time...").unwrap();
                // Re-fetch task to get updated last_execution_time
                match db_ref.get_task(&task_id) {
                    Ok(updated_task) => {
                        match db_ref.update_next_execution_time(&task_id, &updated_task) {
                            Ok(_) => {
                                writeln!(file, "Update returned Ok").unwrap();
                            }
                            Err(e) => {
                                writeln!(file, "Update failed: {:?}", e).unwrap();
                            }
                        }
                    }
                    Err(e) => {
                        writeln!(file, "Failed to re-fetch task: {:?}", e).unwrap();
                    }
                }
            }

            Ok(exec_result)
        }
        Err(e) => {
            let db = state.get_db()?;
            db.as_ref().unwrap().update_task_status(&task_id, "failed").map_err(|e| e.to_string())?;
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn get_tasks(state: State<'_, TaskState>) -> Result<Vec<crate::task_database::Task>, String> {
    log::info!("[get_tasks] Command called");
    let db = state.get_db()?;
    log::info!("[get_tasks] Database acquired, fetching tasks");
    let tasks = db.as_ref().unwrap().get_all_tasks().map_err(|e| e.to_string())?;
    log::info!("[get_tasks] Fetched {} tasks", tasks.len());
    Ok(tasks)
}

#[tauri::command]
pub async fn get_task_detail(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<serde_json::Value, String> {
    let db = state.get_db()?;
    let db_ref = db.as_ref().unwrap();
    let task = db_ref.get_task(&task_id).map_err(|e| e.to_string())?;
    let history = db_ref.get_execution_history(&task_id, Some(50)).map_err(|e| e.to_string())?;

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

    // Debug: Print task fields before serialization
    println!("=== DEBUG: Task fields from database ===");
    println!("task.next_execution_time: {:?}", task.next_execution_time);
    println!("task.last_execution_time: {:?}", task.last_execution_time);
    println!("task.schedule: {:?}", task.schedule);
    println!("task.task_type: {}", task.task_type);

    // Debug: Print serialized JSON
    println!("=== DEBUG: Serialized task JSON ===");
    println!("{}", serde_json::to_string_pretty(&task_json).unwrap_or_default());

    if let Some(obj) = task_json.as_object_mut() {
        obj.insert("lastExecution".to_string(), last_execution.unwrap_or(serde_json::Value::Null));
    }

    let result = serde_json::json!({
        "task": task_json,
        "statistics": statistics,
        "history": history,
    });

    // Debug: Print final response
    println!("=== DEBUG: Final response to frontend ===");
    println!("{}", serde_json::to_string_pretty(&result).unwrap_or_default());

    Ok(result)
}

#[tauri::command]
pub async fn create_task(
    config: TaskConfigInput,
    state: State<'_, TaskState>,
) -> Result<crate::task_database::Task, String> {
    log::info!("[create_task] Command called with task name: {}", config.name);

    let task = {
        log::info!("[create_task] Acquiring database");
        let db = state.get_db()?;
        log::info!("[create_task] Creating task in database");
        db.as_ref().unwrap().create_task(config).map_err(|e| {
            log::error!("[create_task] Database create_task failed: {}", e);
            e.to_string()
        })?
    };

    log::info!("[create_task] Task created with ID: {}, reloading timers", task.id);
    state.reload_unified_timers().await?;
    log::info!("[create_task] Task creation completed successfully");
    Ok(task)
}

#[tauri::command]
pub async fn update_task(
    task_id: String,
    config: TaskConfigInput,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    {
        let db = state.get_db()?;
        db.as_ref().unwrap().update_task(&task_id, config).map_err(|e| e.to_string())?;
    }
    state.reload_unified_timers().await
}

#[tauri::command]
pub async fn delete_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    {
        let db = state.get_db()?;
        db.as_ref().unwrap().delete_task(&task_id).map_err(|e| e.to_string())?;
    }
    state.reload_unified_timers().await
}

#[tauri::command]
pub async fn pause_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    {
        let db = state.get_db()?;
        db.as_ref().unwrap().update_task_status(&task_id, "paused").map_err(|e| e.to_string())?;
    }
    state.reload_unified_timers().await
}

#[tauri::command]
pub async fn resume_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    {
        let db = state.get_db()?;
        db.as_ref().unwrap().update_task_status(&task_id, "idle").map_err(|e| e.to_string())?;
    }
    state.reload_unified_timers().await
}

#[tauri::command]
pub async fn get_execution_history(
    task_id: String,
    limit: Option<i64>,
    state: State<'_, TaskState>,
) -> Result<Vec<ExecutionResult>, String> {
    let db = state.get_db()?;
    db.as_ref().unwrap().get_execution_history(&task_id, limit).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_timer_system_status(
    state: State<'_, TaskState>,
) -> Result<serde_json::Value, String> {
    let status = state.timer_manager.get_status().await;
    serde_json::to_value(status).map_err(|e| e.to_string())
}
