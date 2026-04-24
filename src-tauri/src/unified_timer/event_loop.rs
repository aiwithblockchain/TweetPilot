use crate::unified_timer::registry::TimerRegistry;
use crate::unified_timer::executor::{TimerExecutor, DummyExecutor};
use crate::unified_timer::executors::LocalBridgeSyncExecutor;
use crate::unified_timer::types::{ExecutionContext, Timer};
use std::sync::Arc;
use std::collections::HashMap;
use tauri::AppHandle;
use tokio::sync::{Mutex, RwLock, Notify};
use tokio::time::{sleep, Duration};

pub struct EventLoop {
    registry: Arc<Mutex<TimerRegistry>>,
    running: Arc<RwLock<bool>>,
    executors: Arc<RwLock<HashMap<String, Arc<dyn TimerExecutor>>>>,
    wakeup: Arc<Notify>,
    app_handle: Option<AppHandle>,
}

impl EventLoop {
    pub fn new(registry: Arc<Mutex<TimerRegistry>>, app_handle: Option<AppHandle>) -> Self {
        let mut executors: HashMap<String, Arc<dyn TimerExecutor>> = HashMap::new();
        executors.insert("dummy".to_string(), Arc::new(DummyExecutor));

        Self {
            registry,
            running: Arc::new(RwLock::new(false)),
            executors: Arc::new(RwLock::new(executors)),
            wakeup: Arc::new(Notify::new()),
            app_handle,
        }
    }

    pub fn notify_new_timer(&self) {
        log::debug!("[EventLoop] Notifying event loop of new timer registration");
        self.wakeup.notify_one();
    }

    pub async fn register_executor(&self, name: String, executor: Arc<dyn TimerExecutor>) {
        log::info!("[EventLoop] Registering executor: {}", name);
        let mut executors = self.executors.write().await;
        executors.insert(name.clone(), executor);
        log::info!("[EventLoop] Executor '{}' registered successfully", name);
    }

    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }

    pub async fn get_unmanaged_online_accounts(&self) -> Vec<crate::unified_timer::UnmanagedAccountRecord> {
        let executors = self.executors.read().await;
        executors.values()
            .find_map(|executor| {
                executor
                    .as_any()
                    .downcast_ref::<LocalBridgeSyncExecutor>()
                    .map(|sync| sync.get_unmanaged_online_accounts())
            })
            .unwrap_or_default()
    }

    pub async fn get_unmanaged_online_account(&self, twitter_id: &str) -> Option<crate::unified_timer::UnmanagedAccountRecord> {
        let executors = self.executors.read().await;
        executors.values()
            .find_map(|executor| {
                executor
                    .as_any()
                    .downcast_ref::<LocalBridgeSyncExecutor>()
                    .and_then(|sync| sync.get_unmanaged_online_account(twitter_id))
            })
    }

    pub async fn remove_unmanaged_online_account(&self, twitter_id: &str) {
        let executors = self.executors.read().await;
        if let Some(sync) = executors.values()
            .find_map(|executor| executor.as_any().downcast_ref::<LocalBridgeSyncExecutor>())
        {
            sync.remove_unmanaged_online_account(twitter_id);
        }
    }

    pub async fn stop(&self) {
        log::info!("[EventLoop] Stopping event loop");
        let mut running = self.running.write().await;
        *running = false;
        drop(running);
        self.wakeup.notify_one();
        log::info!("[EventLoop] Event loop stop signal sent");
    }

    pub async fn start(&self) {
        let mut running = self.running.write().await;
        if *running {
            log::warn!("[EventLoop] Already running, skipping start");
            return;
        }
        *running = true;
        drop(running);

        log::info!("[EventLoop] Starting event loop");

        let registry = self.registry.clone();
        let running = self.running.clone();
        let executors = self.executors.clone();
        let wakeup = self.wakeup.clone();
        let app_handle = self.app_handle.clone();

        tokio::spawn(async move {
            log::info!("[EventLoop] ========== Event loop task spawned and running ==========");

            loop {
                let is_running = *running.read().await;
                if !is_running {
                    log::info!("[EventLoop] Stopping event loop");
                    break;
                }

                let next_timer = {
                    let mut reg = registry.lock().await;
                    reg.pop_next()
                };

                match next_timer {
                    Some(timer) => {
                        let now = chrono::Utc::now();
                        log::info!("[EventLoop] Popped timer: {} ({})", timer.id, timer.name);

                        if let Some(next_time) = timer.next_execution {
                            let time_diff = (next_time - now).num_seconds();
                            log::info!("[EventLoop] Timer {} next execution in {} seconds", timer.id, time_diff);

                            if next_time <= now {
                                log::info!("[EventLoop] ⏰ Timer {} is ready for execution (scheduled: {}, now: {})",
                                    timer.id, next_time.to_rfc3339(), now.to_rfc3339());
                                Self::execute_timer(
                                    timer,
                                    registry.clone(),
                                    executors.clone(),
                                    app_handle.clone(),
                                ).await;
                            } else {
                                // Timer not ready yet - sleep until it's ready, then put it back
                                log::info!("[EventLoop] Timer {} not ready, will sleep {} seconds", timer.id, time_diff.min(60));
                                let duration = (next_time - now).to_std().unwrap_or(Duration::from_secs(1));
                                let sleep_duration = duration.min(Duration::from_secs(60));

                                // Sleep WITHOUT putting timer back first
                                let wakeup_clone = wakeup.clone();
                                let sleep_result = tokio::select! {
                                    _ = sleep(sleep_duration) => {
                                        log::info!("[EventLoop] Wake from timeout, timer should be ready now");
                                        "timeout"
                                    }
                                    _ = wakeup_clone.notified() => {
                                        log::info!("[EventLoop] Wake from new timer notification");
                                        "notified"
                                    }
                                };

                                // Now put the timer back to queue
                                {
                                    let mut reg = registry.lock().await;
                                    reg.update_timer(timer.clone());
                                    log::info!("[EventLoop] Timer {} put back to queue after {}", timer.id, sleep_result);
                                }
                            }
                        } else {
                            log::warn!("[EventLoop] Timer {} has no next_execution, discarding", timer.id);
                            sleep(Duration::from_secs(60)).await;
                        }
                    }
                    None => {
                        log::info!("[EventLoop] No timers in queue, sleeping for up to 60 seconds (will wake on new timer registration)");

                        tokio::select! {
                            _ = sleep(Duration::from_secs(60)) => {
                                log::debug!("[EventLoop] Wake from timeout");
                            }
                            _ = wakeup.notified() => {
                                log::debug!("[EventLoop] Wake from notification");
                            }
                        }
                    }
                }
            }

            log::info!("[EventLoop] Event loop task exited");
        });
    }

    async fn execute_timer(
        timer: Timer,
        registry: Arc<Mutex<TimerRegistry>>,
        executors: Arc<RwLock<HashMap<String, Arc<dyn TimerExecutor>>>>,
        app_handle: Option<AppHandle>,
    ) {
        log::info!("[EventLoop] Starting execution of timer: {} ({})", timer.id, timer.name);

        let executor = {
            let executors = executors.read().await;
            executors.get(&timer.executor).cloned()
        };

        if let Some(executor) = executor {
            log::debug!("[EventLoop] Found executor '{}' for timer {}", timer.executor, timer.id);

            let context = ExecutionContext {
                timer_id: timer.id.clone(),
                config: timer.executor_config.clone(),
            };

            log::debug!("[EventLoop] Calling executor.execute() for timer {}", timer.id);
            match executor.execute(context).await {
                Ok(result) => {
                    log::info!("[EventLoop] Timer {} executed successfully in {:.2}s", timer.id, result.duration);

                    let mut updated_timer = timer.clone();
                    updated_timer.last_execution = Some(result.end_time);
                    updated_timer.next_execution = updated_timer.calculate_next_execution(result.end_time);

                    if let Some(next_exec) = updated_timer.next_execution {
                        let now = chrono::Utc::now();
                        let seconds_until = (next_exec - now).num_seconds();
                        log::info!("[EventLoop] Timer {} next execution scheduled in {} seconds ({})",
                            timer.id, seconds_until, next_exec.to_rfc3339());
                    } else {
                        log::info!("[EventLoop] Timer {} has no next execution (one-time task completed)", timer.id);
                    }

                    let mut reg = registry.lock().await;
                    reg.update_timer(updated_timer.clone());
                    drop(reg);

                    if timer.id.starts_with("task-") {
                        if let Some(app_handle) = app_handle.as_ref() {
                            crate::app_events::publish_task_executed(
                                app_handle,
                                timer.id.trim_start_matches("task-").to_string(),
                                "success",
                            );
                        }
                    }
                }
                Err(e) => {
                    log::error!("[EventLoop] Timer {} execution failed: {}", timer.id, e);

                    let mut updated_timer = timer.clone();
                    updated_timer.next_execution = updated_timer.calculate_next_execution(chrono::Utc::now());

                    if let Some(next_exec) = updated_timer.next_execution {
                        let now = chrono::Utc::now();
                        let seconds_until = (next_exec - now).num_seconds();
                        log::warn!("[EventLoop] Timer {} will retry in {} seconds", timer.id, seconds_until);
                    }

                    let mut reg = registry.lock().await;
                    reg.update_timer(updated_timer.clone());
                    drop(reg);

                    if timer.id.starts_with("task-") {
                        if let Some(app_handle) = app_handle.as_ref() {
                            crate::app_events::publish_task_executed(
                                app_handle,
                                timer.id.trim_start_matches("task-").to_string(),
                                "failed",
                            );
                        }
                    }
                }
            }
        } else {
            log::error!("[EventLoop] Executor '{}' not found for timer {}", timer.executor, timer.id);
            log::debug!("[EventLoop] Available executors: {:?}",
                executors.read().await.keys().collect::<Vec<_>>());
        }
    }
}
