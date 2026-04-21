use crate::unified_timer::registry::TimerRegistry;
use crate::unified_timer::executor::{TimerExecutor, DummyExecutor};
use crate::unified_timer::types::{ExecutionContext, Timer};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::{Mutex, RwLock};
use tokio::time::{sleep, Duration};

pub struct EventLoop {
    registry: Arc<Mutex<TimerRegistry>>,
    running: Arc<RwLock<bool>>,
    executors: Arc<RwLock<HashMap<String, Arc<dyn TimerExecutor>>>>,
}

impl EventLoop {
    pub fn new(registry: Arc<Mutex<TimerRegistry>>) -> Self {
        let mut executors: HashMap<String, Arc<dyn TimerExecutor>> = HashMap::new();
        executors.insert("dummy".to_string(), Arc::new(DummyExecutor));

        Self {
            registry,
            running: Arc::new(RwLock::new(false)),
            executors: Arc::new(RwLock::new(executors)),
        }
    }

    pub async fn register_executor(&self, name: String, executor: Arc<dyn TimerExecutor>) {
        log::info!("[EventLoop] Registering executor: {}", name);
        let mut executors = self.executors.write().await;
        executors.insert(name.clone(), executor);
        log::info!("[EventLoop] Executor '{}' registered successfully", name);
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

        tokio::spawn(async move {
            log::info!("[EventLoop] Event loop task spawned");

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
                        log::debug!("[EventLoop] Popped timer: {} ({})", timer.id, timer.name);

                        if let Some(next_time) = timer.next_execution {
                            let time_diff = (next_time - now).num_seconds();
                            log::debug!("[EventLoop] Timer {} next execution in {} seconds", timer.id, time_diff);

                            if next_time <= now {
                                log::info!("[EventLoop] Executing timer {} immediately", timer.id);
                                Self::execute_timer(
                                    timer,
                                    registry.clone(),
                                    executors.clone(),
                                ).await;
                            } else {
                                log::debug!("[EventLoop] Timer {} not ready, putting back to queue", timer.id);
                                {
                                    let mut reg = registry.lock().await;
                                    reg.update_timer(timer.clone());
                                }
                                let duration = (next_time - now).to_std().unwrap_or(Duration::from_secs(1));
                                let sleep_duration = duration.min(Duration::from_secs(60));
                                log::debug!("[EventLoop] Sleeping for {} seconds", sleep_duration.as_secs());
                                sleep(sleep_duration).await;
                            }
                        } else {
                            log::warn!("[EventLoop] Timer {} has no next_execution, discarding", timer.id);
                            sleep(Duration::from_secs(60)).await;
                        }
                    }
                    None => {
                        log::debug!("[EventLoop] No timers in queue, sleeping for 60 seconds");
                        sleep(Duration::from_secs(60)).await;
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

                    // Call post-execution callback if available
                    if let Err(e) = executor.post_execution(&updated_timer).await {
                        log::warn!("[EventLoop] Post-execution callback failed for timer {}: {}", timer.id, e);
                    }

                    let mut reg = registry.lock().await;
                    reg.update_timer(updated_timer);
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
                    reg.update_timer(updated_timer);
                }
            }
        } else {
            log::error!("[EventLoop] Executor '{}' not found for timer {}", timer.executor, timer.id);
            log::debug!("[EventLoop] Available executors: {:?}",
                executors.read().await.keys().collect::<Vec<_>>());
        }
    }
}
