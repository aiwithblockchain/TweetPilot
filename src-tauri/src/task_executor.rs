use std::ffi::OsString;
use std::process::{Command, Stdio};
use std::time::Instant;
use uuid::Uuid;
use crate::task_database::{ExecutionResult, Task};

fn build_script_metadata(script_path: &str, working_directory: &str, command: &str) -> Option<String> {
    serde_json::json!({
        "scriptPath": script_path,
        "workingDirectory": working_directory,
        "command": command,
    })
    .to_string()
    .into()
}

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
        log::info!("[TaskExecutor] Starting execution for task: {} ({})", task.name, task.id);
        let start_time = Instant::now();
        let start_time_str = chrono::Utc::now().to_rfc3339();

        // Build command
        let script_path = if task.script_path.starts_with('/') {
            task.script_path.clone()
        } else {
            format!("{}/{}", workspace_root, task.script_path)
        };
        log::info!("[TaskExecutor] Script path: {}", script_path);

        let script_path_ref = std::path::Path::new(&script_path);
        if !script_path_ref.exists() {
            return Err(format!("Script not found: {}", script_path));
        }
        if !script_path_ref.is_file() {
            return Err(format!("Script path is not a file: {}", script_path));
        }
        let script_dir = script_path_ref.parent()
            .ok_or_else(|| format!("Cannot resolve script directory for {}", script_path))?;

        let mut cmd = Command::new(&self.python_path);
        cmd.arg(&script_path);
        cmd.current_dir(script_dir);

        log::info!("[TaskExecutor] Executing Python script using script_path only");
        log::info!("[TaskExecutor] Using script working directory: {}", script_dir.display());

        // Set environment
        let home = dirs::home_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "/tmp".to_string());
        let clawbot_python_path = format!("{}/.tweetpilot/clawbot", home);
        let mut python_path_entries = vec![clawbot_python_path.clone()];
        if let Some(existing_python_path) = std::env::var_os("PYTHONPATH") {
            python_path_entries.extend(std::env::split_paths(&existing_python_path).map(|path| path.display().to_string()));
        }
        let python_path = std::env::join_paths(python_path_entries.iter().map(OsString::from))
            .map_err(|e| format!("Failed to build PYTHONPATH: {}", e))?;
        cmd.env("PYTHONPATH", python_path);
        log::info!("[TaskExecutor] Using ClawBot PYTHONPATH root: {}", clawbot_python_path);

        let command_preview = format!(
            "cd \"{}\" && PYTHONPATH=\"{}\" \"{}\" \"{}\"",
            script_dir.display(),
            clawbot_python_path,
            self.python_path,
            script_path,
        );
        let metadata = build_script_metadata(
            &script_path,
            &script_dir.display().to_string(),
            &command_preview,
        );

        // Set timeout
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        log::info!("[TaskExecutor] Executing command: {:?}", cmd);

        // Execute
        let output = if let Some(timeout) = task.timeout {
            log::info!("[TaskExecutor] Executing with timeout: {}s", timeout);
            tokio::time::timeout(
                std::time::Duration::from_secs(timeout as u64),
                tokio::task::spawn_blocking(move || cmd.output())
            )
            .await
            .map_err(|_| {
                log::error!("[TaskExecutor] Task execution timeout");
                "Task execution timeout".to_string()
            })?
            .map_err(|e| {
                log::error!("[TaskExecutor] Failed to execute task: {}", e);
                format!("Failed to execute task: {}", e)
            })?
        } else {
            log::info!("[TaskExecutor] Executing without timeout");
            tokio::task::spawn_blocking(move || cmd.output())
                .await
                .map_err(|e| {
                    log::error!("[TaskExecutor] Failed to execute task: {}", e);
                    format!("Failed to execute task: {}", e)
                })?
        }
        .map_err(|e| {
            log::error!("[TaskExecutor] Failed to execute script: {}", e);
            format!("Failed to execute script: {}", e)
        })?;

        let duration = start_time.elapsed().as_secs_f64();
        let end_time_str = chrono::Utc::now().to_rfc3339();

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let exit_code = output.status.code().unwrap_or(-1);
        let status = if output.status.success() { "success" } else { "failure" };
        let error_message = if status == "failure" && !stderr.is_empty() {
            Some(stderr.clone())
        } else {
            None
        };

        log::info!("[TaskExecutor] Execution completed: status={}, exit_code={}, duration={:.2}s", status, exit_code, duration);
        log::info!("[TaskExecutor] stdout: {}", stdout);
        log::info!("[TaskExecutor] stderr: {}", stderr);

        Ok(ExecutionResult {
            id: Uuid::new_v4().to_string(),
            task_id: task.id.clone(),
            run_no: None,
            session_code: None,
            task_session_id: None,
            start_time: start_time_str,
            end_time: Some(end_time_str),
            duration: Some(duration),
            status: status.to_string(),
            exit_code: Some(exit_code),
            stdout,
            stderr,
            final_output: None,
            error_message,
            metadata,
        })
    }
}
