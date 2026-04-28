use crate::task_ai_executor::execute_task_ai_session;
use crate::task_database::TaskDatabase;
use crate::unified_timer::executor::TimerExecutor;
use crate::unified_timer::types::{ExecutionContext, ExecutionResult, Timer};
use async_trait::async_trait;
use std::sync::{Arc, Mutex};

pub struct TaskAiSessionExecutor {
    workspace_root: String,
    db: Arc<Mutex<TaskDatabase>>,
}

impl TaskAiSessionExecutor {
    pub fn new(workspace_root: String, db: Arc<Mutex<TaskDatabase>>) -> Self {
        Self { workspace_root, db }
    }
}

#[async_trait]
impl TimerExecutor for TaskAiSessionExecutor {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String> {
        if !context.timer_id.starts_with("task-") {
            return Err(format!("Unsupported timer id for task AI session executor: {}", context.timer_id));
        }

        let task_id = context.timer_id.strip_prefix("task-").unwrap();
        let task = {
            let db_guard = self.db.lock().map_err(|e| e.to_string())?;
            db_guard.get_task(task_id).map_err(|e| e.to_string())?
        };

        let result = execute_task_ai_session(&task, &self.workspace_root, self.db.clone()).await?;
        let start_time = chrono::DateTime::parse_from_rfc3339(&result.start_time)
            .map_err(|e| format!("Failed to parse execution start time: {}", e))?
            .with_timezone(&chrono::Utc);
        let end_time = result
            .end_time
            .as_deref()
            .ok_or_else(|| "Task AI session execution finished without end_time".to_string())
            .and_then(|value| {
                chrono::DateTime::parse_from_rfc3339(value)
                    .map_err(|e| format!("Failed to parse execution end time: {}", e))
            })?
            .with_timezone(&chrono::Utc);

        Ok(ExecutionResult {
            timer_id: context.timer_id,
            start_time,
            end_time,
            duration: result.duration.unwrap_or(0.0),
            success: result.status == "success",
            output: result.final_output.unwrap_or(result.stdout),
            error: result.error_message.or_else(|| {
                if result.stderr.is_empty() {
                    None
                } else {
                    Some(result.stderr)
                }
            }),
        })
    }

    fn timeout(&self) -> Option<std::time::Duration> {
        Some(std::time::Duration::from_secs(300))
    }

    async fn post_execution(&self, timer: &Timer) -> Result<(), String> {
        if !timer.id.starts_with("task-") {
            return Ok(());
        }

        let task_id = timer.id.strip_prefix("task-").unwrap();
        let db_guard = self.db.lock().map_err(|e| e.to_string())?;
        let next_exec_str = timer.next_execution.map(|t| t.to_rfc3339());
        let last_exec_str = timer.last_execution.map(|t| t.to_rfc3339());

        db_guard
            .update_task_execution_times(task_id, next_exec_str, last_exec_str)
            .map_err(|e| format!("Failed to update database: {}", e))
    }
}
