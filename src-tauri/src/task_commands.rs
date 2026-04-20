use tauri::State;
use std::sync::Mutex;
use crate::task_database::{TaskDatabase, TaskConfigInput, ExecutionResult};
use crate::task_executor::TaskExecutor;

use std::sync::Arc;

pub struct TaskState {
    pub db: Arc<Mutex<Option<TaskDatabase>>>,
    pub executor: Arc<TaskExecutor>,
    pub workspace_root: Arc<Mutex<String>>,
}

impl TaskState {
    pub fn init_database(&self, workspace_path: &str) -> Result<(), String> {
        let db_path = std::path::Path::new(workspace_path).join(".tweetpilot/tasks.db");

        // Create parent directory
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let task_db = TaskDatabase::new(db_path).map_err(|e| e.to_string())?;
        let mut db = self.db.lock().map_err(|e| e.to_string())?;
        *db = Some(task_db);
        Ok(())
    }

    fn get_db(&self) -> Result<std::sync::MutexGuard<'_, Option<TaskDatabase>>, String> {
        let db = self.db.lock().map_err(|e| e.to_string())?;
        if db.is_none() {
            return Err("数据库未初始化，请先选择工作区".to_string());
        }
        Ok(db)
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

            // Update next_execution_time for scheduled tasks if execution was successful
            if task.task_type == "scheduled" && exec_result.status == "success" {
                if let Some(schedule) = &task.schedule {
                    writeln!(file, "Calling update_next_execution_time...").unwrap();
                    match db_ref.update_next_execution_time(&task_id, schedule) {
                        Ok(_) => {
                            writeln!(file, "Update returned Ok").unwrap();
                        }
                        Err(e) => {
                            writeln!(file, "Update failed: {:?}", e).unwrap();
                        }
                    }
                }
            }

            db_ref.update_task_status(&task_id, "idle").map_err(|e| e.to_string())?;
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
    let db = state.get_db()?;
    db.as_ref().unwrap().get_all_tasks().map_err(|e| e.to_string())
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
    let db = state.get_db()?;
    db.as_ref().unwrap().create_task(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_task(
    task_id: String,
    config: TaskConfigInput,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let db = state.get_db()?;
    db.as_ref().unwrap().update_task(&task_id, config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let db = state.get_db()?;
    db.as_ref().unwrap().delete_task(&task_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pause_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let db = state.get_db()?;
    db.as_ref().unwrap().update_task_status(&task_id, "paused").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resume_task(
    task_id: String,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let db = state.get_db()?;
    db.as_ref().unwrap().update_task_status(&task_id, "idle").map_err(|e| e.to_string())
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
