use crate::unified_timer::types::{ExecutionContext, ExecutionResult, Timer};
use crate::unified_timer::executor::TimerExecutor;
use crate::task_database::TaskDatabase;
use async_trait::async_trait;
use std::process::{Command, Stdio};
use std::time::Instant;
use std::sync::{Arc, Mutex};

pub struct PythonScriptExecutor {
    python_path: String,
    workspace_root: String,
    db: Arc<Mutex<Option<TaskDatabase>>>,
}

impl PythonScriptExecutor {
    pub fn new(workspace_root: String, db: Arc<Mutex<Option<TaskDatabase>>>) -> Self {
        Self {
            python_path: "python3".to_string(),
            workspace_root,
            db,
        }
    }
}

#[async_trait]
impl TimerExecutor for PythonScriptExecutor {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String> {
        let start_time = chrono::Utc::now();
        let start_instant = Instant::now();

        // Parse configuration
        let script_path = context.config.get("script_path")
            .and_then(|v| v.as_str())
            .ok_or("Missing script_path in config")?;

        let account_id = context.config.get("account_id")
            .and_then(|v| v.as_str())
            .ok_or("Missing account_id in config")?;

        let parameters = context.config.get("parameters")
            .and_then(|v| v.as_object())
            .cloned()
            .unwrap_or_default();

        let timeout_secs = context.config.get("timeout")
            .and_then(|v| v.as_u64())
            .unwrap_or(300);

        // Build command
        let full_script_path = if script_path.starts_with('/') {
            script_path.to_string()
        } else {
            format!("{}/{}", self.workspace_root, script_path)
        };

        // 检查脚本是否存在
        if !std::path::Path::new(&full_script_path).exists() {
            return Err(format!("Script not found: {}", full_script_path));
        }

        let mut cmd = Command::new(&self.python_path);
        cmd.arg(&full_script_path);
        cmd.arg("--account").arg(account_id);

        // Add task parameters - 分开传递避免空格问题
        for (key, value) in parameters {
            let value_str = match value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                _ => value.to_string(),
            };
            cmd.arg(format!("--{}", key)).arg(value_str);
        }

        // Set environment - 正确处理 home 目录
        let home = dirs::home_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "/tmp".to_string());
        cmd.env("PYTHONPATH", format!("{}/.tweetpilot:{}/.tweetpilot", self.workspace_root, home));
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // Execute with timeout
        let output = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            tokio::task::spawn_blocking(move || cmd.output())
        )
        .await
        .map_err(|_| "Task execution timeout".to_string())?
        .map_err(|e| format!("Failed to execute task: {}", e))?
        .map_err(|e| format!("Failed to execute script: {}", e))?;

        let duration = start_instant.elapsed().as_secs_f64();
        let end_time = chrono::Utc::now();

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let success = output.status.success();

        // Save execution result to database
        if context.timer_id.starts_with("task-") {
            let task_id = context.timer_id.strip_prefix("task-").unwrap();

            let db_guard = self.db.lock().unwrap();
            if let Some(ref db) = *db_guard {
                let db_result = crate::task_database::ExecutionResult {
                    id: uuid::Uuid::new_v4().to_string(),
                    task_id: task_id.to_string(),
                    status: if success { "success".to_string() } else { "failed".to_string() },
                    stdout: stdout.clone(),
                    stderr: stderr.clone(),
                    start_time: start_time.to_rfc3339(),
                    end_time: end_time.to_rfc3339(),
                    duration,
                    exit_code: output.status.code().unwrap_or(if success { 0 } else { 1 }),
                    metadata: None,
                };

                if let Err(e) = db.save_execution(&db_result) {
                    log::error!("[PythonScriptExecutor] Failed to save execution result: {}", e);
                } else {
                    log::info!("[PythonScriptExecutor] Saved execution result for task {}", task_id);
                }
            }
        }

        if success {
            Ok(ExecutionResult {
                timer_id: context.timer_id,
                start_time,
                end_time,
                duration,
                success: true,
                output: stdout,
                error: None,
            })
        } else {
            Ok(ExecutionResult {
                timer_id: context.timer_id,
                start_time,
                end_time,
                duration,
                success: false,
                output: stdout,
                error: Some(stderr),
            })
        }
    }

    fn timeout(&self) -> Option<std::time::Duration> {
        Some(std::time::Duration::from_secs(300))
    }

    async fn post_execution(&self, timer: &Timer) -> Result<(), String> {
        if !timer.id.starts_with("task-") {
            return Ok(());
        }

        let task_id = timer.id.strip_prefix("task-").unwrap();

        let db_guard = self.db.lock().unwrap();
        if let Some(ref db) = *db_guard {
            let next_exec_str = timer.next_execution.map(|t| t.to_rfc3339());
            let last_exec_str = timer.last_execution.map(|t| t.to_rfc3339());

            log::info!("[PythonScriptExecutor] Updating task {} in database: next_execution={:?}",
                task_id, next_exec_str);

            if let Err(e) = db.update_task_execution_times(task_id, next_exec_str, last_exec_str) {
                log::error!("[PythonScriptExecutor] Failed to update task {} in database: {}", task_id, e);
                return Err(format!("Failed to update database: {}", e));
            }

            log::info!("[PythonScriptExecutor] Successfully updated task {} in database", task_id);
        } else {
            log::warn!("[PythonScriptExecutor] Database not available for task {}", task_id);
        }

        Ok(())
    }
}
