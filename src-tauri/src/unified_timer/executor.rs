use crate::unified_timer::types::{ExecutionContext, ExecutionResult, Timer};
use async_trait::async_trait;
use std::time::Duration;

#[async_trait]
pub trait TimerExecutor: Send + Sync {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String>;

    fn timeout(&self) -> Option<Duration> {
        Some(Duration::from_secs(300))
    }

    async fn post_execution(&self, _timer: &Timer) -> Result<(), String> {
        Ok(())
    }
}

pub struct DummyExecutor;

#[async_trait]
impl TimerExecutor for DummyExecutor {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String> {
        let start_time = chrono::Utc::now();

        tokio::time::sleep(Duration::from_millis(100)).await;

        let end_time = chrono::Utc::now();
        let duration = (end_time - start_time).num_milliseconds() as f64 / 1000.0;

        Ok(ExecutionResult {
            timer_id: context.timer_id,
            start_time,
            end_time,
            duration,
            success: true,
            output: "Dummy execution completed".to_string(),
            error: None,
        })
    }
}
