use cron::Schedule;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::sleep;

use crate::task_database::{Task, TaskDatabase};
use crate::task_executor::TaskExecutor;

#[derive(Clone)]
pub struct TaskScheduler {
    db: Arc<Mutex<Option<TaskDatabase>>>,
    executor: Arc<TaskExecutor>,
    workspace_root: Arc<Mutex<String>>,
    running: Arc<Mutex<bool>>,
}

impl TaskScheduler {
    pub fn new(
        db: Arc<Mutex<Option<TaskDatabase>>>,
        executor: Arc<TaskExecutor>,
        workspace_root: Arc<Mutex<String>>,
    ) -> Self {
        Self {
            db,
            executor,
            workspace_root,
            running: Arc::new(Mutex::new(false)),
        }
    }

    pub async fn start(&self) {
        let mut running = self.running.lock().unwrap();
        if *running {
            return;
        }
        *running = true;
        drop(running);

        // Recalculate missed executions on startup
        {
            let db_guard = self.db.lock().unwrap();
            if let Some(ref db_ref) = *db_guard {
                let _ = db_ref.recalculate_missed_executions();
            }
        }

        let db = self.db.clone();
        let executor = self.executor.clone();
        let workspace_root = self.workspace_root.clone();
        let running = self.running.clone();

        tokio::spawn(async move {
            loop {
                // Check if still running
                {
                    let is_running = running.lock().unwrap();
                    if !*is_running {
                        break;
                    }
                }

                // Check for scheduled tasks
                if let Err(e) = Self::check_and_execute_tasks(&db, &executor, &workspace_root).await {
                    eprintln!("Task scheduler error: {}", e);
                }

                // Sleep for 60 seconds before next check
                sleep(Duration::from_secs(60)).await;
            }
        });
    }

    #[allow(dead_code)]
    pub fn stop(&self) {
        let mut running = self.running.lock().unwrap();
        *running = false;
    }

    async fn check_and_execute_tasks(
        db: &Arc<Mutex<Option<TaskDatabase>>>,
        executor: &Arc<TaskExecutor>,
        workspace_root: &Arc<Mutex<String>>,
    ) -> Result<(), String> {
        let tasks = {
            let db_guard = db.lock().map_err(|e| e.to_string())?;
            if let Some(ref db_ref) = *db_guard {
                db_ref.get_all_tasks().map_err(|e| e.to_string())?
            } else {
                return Ok(());
            }
        };

        let now = chrono::Utc::now();

        for task in tasks {
            // Only check scheduled tasks that are enabled and idle
            if task.task_type != "scheduled" || !task.enabled || task.status != "idle" {
                continue;
            }

            // For interval timers, we don't need to parse cron schedule
            let schedule = if task.schedule_type == "interval" {
                // Dummy schedule, won't be used for interval timers
                Schedule::from_str("0 0 * * * *").unwrap()
            } else {
                // Parse cron schedule for cron timers
                let schedule_str = match &task.schedule {
                    Some(s) => s,
                    None => continue,
                };

                match Schedule::from_str(schedule_str) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("Invalid cron schedule for task {}: {}", task.id, e);
                        continue;
                    }
                }
            };

            // Check if task should run now
            if Self::should_run_now(&task, &schedule, now) {
                // Execute task
                let workspace = workspace_root.lock().map_err(|e| e.to_string())?;
                let workspace_path = workspace.clone();
                drop(workspace);

                if workspace_path.is_empty() {
                    continue;
                }

                // Update status to running
                {
                    let db_guard = db.lock().map_err(|e| e.to_string())?;
                    if let Some(ref db_ref) = *db_guard {
                        db_ref.update_task_status(&task.id, "running").map_err(|e| e.to_string())?;
                    }
                }

                // Execute task in background
                let task_clone = task.clone();
                let executor_clone = executor.clone();
                let workspace_clone = workspace_path.clone();
                let db_clone = db.clone();

                tokio::spawn(async move {
                    let result = executor_clone.execute_task(&task_clone, &workspace_clone).await;

                    // Save result
                    let db_guard = db_clone.lock().unwrap();
                    if let Some(ref db_ref) = *db_guard {
                        match result {
                            Ok(exec_result) => {
                                eprintln!("✅ Task {} executed successfully", task_clone.id);

                                if let Err(e) = db_ref.save_execution(&exec_result) {
                                    eprintln!("❌ Failed to save execution: {}", e);
                                }

                                // Update next_execution_time for scheduled tasks
                                if task_clone.task_type == "scheduled" {
                                    eprintln!("📅 Updating next execution time for task {}", task_clone.id);
                                    // Re-fetch task to get updated last_execution_time
                                    match db_ref.get_task(&task_clone.id) {
                                        Ok(updated_task) => {
                                            if let Err(e) = db_ref.update_next_execution_time(&task_clone.id, &updated_task) {
                                                eprintln!("❌ Failed to update next execution time: {}", e);
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("❌ Failed to re-fetch task: {}", e);
                                        }
                                    }
                                }

                                eprintln!("🔄 Setting task {} status to idle", task_clone.id);
                                if let Err(e) = db_ref.update_task_status(&task_clone.id, "idle") {
                                    eprintln!("❌ Failed to update task status: {}", e);
                                }
                            }
                            Err(e) => {
                                eprintln!("❌ Task {} execution failed: {}", task_clone.id, e);
                                let _ = db_ref.update_task_status(&task_clone.id, "failed");
                            }
                        }
                    }
                });
            }
        }

        Ok(())
    }

    fn should_run_now(task: &Task, schedule: &Schedule, now: chrono::DateTime<chrono::Utc>) -> bool {
        // Check if task has been executed recently (within last 2 minutes)
        if let Some(ref last_exec) = task.last_execution_time {
            if let Ok(last_time) = chrono::DateTime::parse_from_rfc3339(last_exec) {
                let diff = now.signed_duration_since(last_time.with_timezone(&chrono::Utc));
                if diff.num_seconds() < 120 {
                    return false;
                }
            }
        }

        // Check based on schedule_type
        match task.schedule_type.as_str() {
            "interval" => {
                // Interval timer: check if next_execution_time has passed
                if let Some(ref next_exec) = task.next_execution_time {
                    if let Ok(next_time) = chrono::DateTime::parse_from_rfc3339(next_exec) {
                        return now >= next_time.with_timezone(&chrono::Utc);
                    }
                }
                false
            }
            "cron" => {
                // Cron timer: check if current time matches schedule
                let upcoming = schedule.upcoming(chrono::Utc).take(1).next();
                if let Some(next_time) = upcoming {
                    let diff = next_time.signed_duration_since(now);
                    // If next scheduled time is within 60 seconds, run now
                    diff.num_seconds() <= 60
                } else {
                    false
                }
            }
            _ => false
        }
    }
}
