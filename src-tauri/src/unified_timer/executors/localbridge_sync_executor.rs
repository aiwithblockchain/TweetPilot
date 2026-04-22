use crate::unified_timer::executor::TimerExecutor;
use crate::unified_timer::types::{ExecutionContext, ExecutionResult};
use async_trait::async_trait;
use chrono::Utc;

pub struct LocalBridgeSyncExecutor;

impl LocalBridgeSyncExecutor {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl TimerExecutor for LocalBridgeSyncExecutor {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String> {
        let start_time = Utc::now();
        log::info!("[LocalBridgeSyncExecutor] Starting LocalBridge instance sync for timer {}", context.timer_id);

        let config = crate::commands::preferences::get_local_bridge_config()
            .await
            .map_err(|e| {
                log::error!("[LocalBridgeSyncExecutor] Failed to get LocalBridge config: {}", e);
                format!("Failed to get LocalBridge config: {}", e)
            })?;

        let client = crate::services::localbridge::LocalBridgeClient::new(
            config.endpoint.clone(),
            config.timeout_ms,
        )
        .map_err(|e| {
            log::error!("[LocalBridgeSyncExecutor] Failed to create LocalBridge client: {}", e);
            format!("Failed to create LocalBridge client: {}", e)
        })?;

        let instances = client.get_instances().await.map_err(|e| {
            log::error!("[LocalBridgeSyncExecutor] Failed to get instances: {}", e);
            format!("Failed to get instances: {}", e)
        })?;

        log::info!("[LocalBridgeSyncExecutor] Found {} instances from LocalBridge", instances.len());

        for instance in &instances {
            let instance_id = instance
                .get("instanceId")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let instance_name = instance
                .get("instanceName")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            log::info!("[LocalBridgeSyncExecutor] Instance: {} ({})", instance_name, instance_id);
        }

        let end_time = Utc::now();
        let duration = (end_time - start_time).num_milliseconds() as f64 / 1000.0;
        let output = format!(
            "LocalBridge sync completed: {} instances found",
            instances.len()
        );

        log::info!("[LocalBridgeSyncExecutor] {} in {:.3}s", output, duration);

        Ok(ExecutionResult {
            timer_id: context.timer_id,
            start_time,
            end_time,
            duration,
            success: true,
            output,
            error: None,
        })
    }
}
