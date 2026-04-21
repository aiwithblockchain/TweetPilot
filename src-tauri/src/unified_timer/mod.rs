mod types;
mod executor;
mod registry;
mod event_loop;
pub mod executors;

pub use types::{Timer, TimerType};
pub use executor::TimerExecutor;
pub use registry::TimerRegistry;
pub use event_loop::EventLoop;
pub use executors::{AccountSyncExecutor, PythonScriptExecutor};

use std::sync::Arc;
use tokio::sync::Mutex;

pub struct UnifiedTimerManager {
    pub registry: Arc<Mutex<TimerRegistry>>,
    event_loop: Arc<EventLoop>,
}

impl UnifiedTimerManager {
    pub fn new() -> Self {
        let registry = Arc::new(Mutex::new(TimerRegistry::new()));
        let event_loop = Arc::new(EventLoop::new(registry.clone()));

        Self {
            registry,
            event_loop,
        }
    }

    pub async fn register_timer(&self, timer: Timer) -> Result<(), String> {
        log::info!("[UnifiedTimerManager] Registering timer: {} ({})", timer.id, timer.name);
        let mut registry = self.registry.lock().await;
        let result = registry.register(timer);
        if result.is_ok() {
            log::info!("[UnifiedTimerManager] Timer registered successfully");
        } else {
            log::error!("[UnifiedTimerManager] Timer registration failed");
        }
        result
    }

    pub async fn clear_task_timers(&self) {
        log::info!("[UnifiedTimerManager] Clearing task timers");
        let mut registry = self.registry.lock().await;
        let task_timer_ids: Vec<String> = registry
            .list_all()
            .into_iter()
            .filter(|timer| timer.id.starts_with("task-"))
            .map(|timer| timer.id)
            .collect();

        log::info!("[UnifiedTimerManager] Found {} task timers to clear", task_timer_ids.len());
        for timer_id in task_timer_ids {
            log::debug!("[UnifiedTimerManager] Unregistering timer: {}", timer_id);
            if let Err(e) = registry.unregister(&timer_id) {
                log::warn!("[UnifiedTimerManager] Failed to unregister timer {}: {}", timer_id, e);
            }
        }
        log::info!("[UnifiedTimerManager] Task timers cleared");
    }

    pub async fn start(&self) {
        log::info!("[UnifiedTimerManager] Starting unified timer system");
        self.event_loop.start().await;
        log::info!("[UnifiedTimerManager] Unified timer system started");
    }

    pub async fn register_executor(&self, name: String, executor: Arc<dyn TimerExecutor>) {
        log::info!("[UnifiedTimerManager] Registering executor: {}", name);
        self.event_loop.register_executor(name, executor).await;
    }
}
