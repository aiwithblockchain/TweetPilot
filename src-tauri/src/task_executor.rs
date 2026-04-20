use std::process::{Command, Stdio};
use std::time::Instant;
use uuid::Uuid;
use crate::task_database::{ExecutionResult, Task};

pub struct TaskExecutor {
    python_path: String,
}

impl TaskExecutor {
    pub fn new() -> Self {
        Self {
            python_path: "python3".to_string(),
        }
    }

    pub async fn execute_task(&self, task: &Task, workspace_root: &str) -> Result<ExecutionResult, String> {
        let start_time = Instant::now();
        let start_time_str = chrono::Utc::now().to_rfc3339();

        // Parse parameters
        let parameters: serde_json::Value = serde_json::from_str(&task.parameters)
            .map_err(|e| format!("Failed to parse parameters: {}", e))?;

        // Build command
        let script_path = if task.script_path.starts_with('/') {
            task.script_path.clone()
        } else {
            format!("{}/{}", workspace_root, task.script_path)
        };

        let mut cmd = Command::new(&self.python_path);
        cmd.arg(&script_path);

        // Add account parameter
        cmd.arg("--account").arg(&task.account_id);

        // Add task parameters
        if let Some(params_obj) = parameters.as_object() {
            for (key, value) in params_obj {
                let value_str = match value {
                    serde_json::Value::String(s) => s.clone(),
                    serde_json::Value::Number(n) => n.to_string(),
                    serde_json::Value::Bool(b) => b.to_string(),
                    _ => value.to_string(),
                };
                cmd.arg(format!("--{}={}", key, value_str));
            }
        }

        // Set environment
        cmd.env("PYTHONPATH", format!("{}/.tweetpilot:~/.tweetpilot", workspace_root));

        // Set timeout
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // Execute
        let output = if let Some(timeout) = task.timeout {
            tokio::time::timeout(
                std::time::Duration::from_secs(timeout as u64),
                tokio::task::spawn_blocking(move || cmd.output())
            )
            .await
            .map_err(|_| "Task execution timeout".to_string())?
            .map_err(|e| format!("Failed to execute task: {}", e))?
        } else {
            tokio::task::spawn_blocking(move || cmd.output())
                .await
                .map_err(|e| format!("Failed to execute task: {}", e))?
        }
        .map_err(|e| format!("Failed to execute script: {}", e))?;

        let duration = start_time.elapsed().as_secs_f64();
        let end_time_str = chrono::Utc::now().to_rfc3339();

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);
        let status = if output.status.success() { "success" } else { "failure" };

        Ok(ExecutionResult {
            id: Uuid::new_v4().to_string(),
            task_id: task.id.clone(),
            start_time: start_time_str,
            end_time: end_time_str,
            duration,
            status: status.to_string(),
            exit_code,
            stdout,
            stderr,
            metadata: None,
        })
    }
}
