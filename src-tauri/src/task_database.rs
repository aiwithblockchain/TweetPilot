use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;
use cron::Schedule;
use std::str::FromStr;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub task_type: String,
    pub status: String,
    pub enabled: bool,
    pub script_path: String,
    pub script_content: Option<String>,
    pub script_hash: Option<String>,
    pub schedule: Option<String>,
    #[serde(rename = "scheduleType")]
    pub schedule_type: String,
    #[serde(rename = "intervalSeconds")]
    pub interval_seconds: Option<i64>,
    pub timeout: Option<i64>,
    pub retry_count: Option<i64>,
    pub retry_delay: Option<i64>,
    #[serde(rename = "accountScreenName")]
    pub account_id: String,
    pub parameters: String,
    #[serde(rename = "lastExecutionTime")]
    pub last_execution_time: Option<String>,
    #[serde(rename = "nextExecutionTime")]
    pub next_execution_time: Option<String>,
    pub total_executions: i64,
    pub success_count: i64,
    pub failure_count: i64,
    pub average_duration: f64,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub id: String,
    pub task_id: String,
    pub start_time: String,
    pub end_time: String,
    pub duration: f64,
    pub status: String,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TaskConfigInput {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub task_type: String,
    pub script_path: String,
    pub schedule: Option<String>,
    pub schedule_type: Option<String>,
    pub interval_seconds: Option<i64>,
    pub timeout: Option<i64>,
    pub retry_count: Option<i64>,
    pub retry_delay: Option<i64>,
    pub account_id: String,
    pub parameters: Option<serde_json::Value>,
    pub tags: Option<Vec<String>>,
}

pub struct TaskDatabase {
    conn: Connection,
}

impl TaskDatabase {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        Self::init_schema(&conn)?;
        Ok(Self { conn })
    }

    fn init_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(include_str!("../migrations/001_create_tasks_tables.sql"))?;
        conn.execute_batch(include_str!("../migrations/002_create_accounts_table.sql"))?;
        Ok(())
    }

    pub fn create_task(&self, input: TaskConfigInput) -> Result<Task> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now();
        let now_str = now.to_rfc3339();
        let parameters = serde_json::to_string(&input.parameters.unwrap_or(serde_json::json!({})))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let tags = input.tags.map(|t| serde_json::to_string(&t).unwrap());

        let schedule_type = input.schedule_type.as_deref().unwrap_or("cron");

        // Calculate next_execution_time for scheduled tasks
        let next_execution_time = if input.task_type == "scheduled" {
            match schedule_type {
                "interval" => {
                    // Interval timer: current time + interval_seconds
                    if let Some(interval_secs) = input.interval_seconds {
                        let next = now + chrono::Duration::seconds(interval_secs);
                        Some(next.to_rfc3339())
                    } else {
                        None
                    }
                }
                "cron" => {
                    // Cron timer: calculate next cron time
                    input.schedule.as_ref().and_then(|schedule_str| {
                        match Self::calculate_next_execution(schedule_str, now) {
                            Ok(next_time) => Some(next_time),
                            Err(_) => None,
                        }
                    })
                }
                _ => None
            }
        } else {
            None
        };

        self.conn.execute(
            "INSERT INTO tasks (
                id, name, description, type, status, enabled,
                script_path, schedule, schedule_type, interval_seconds, timeout, retry_count, retry_delay,
                account_id, parameters, tags, next_execution_time, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)",
            params![
                id,
                input.name,
                input.description,
                input.task_type,
                "idle",
                true,
                input.script_path,
                input.schedule,
                schedule_type,
                input.interval_seconds,
                input.timeout,
                input.retry_count,
                input.retry_delay,
                input.account_id,
                parameters,
                tags,
                next_execution_time,
                now_str,
                now_str,
            ],
        )?;

        self.get_task(&id)
    }

    fn calculate_next_execution(schedule_str: &str, _from_time: chrono::DateTime<chrono::Utc>) -> Result<String> {
        println!("=== DEBUG: calculate_next_execution called ===");
        println!("Input schedule_str: {}", schedule_str);

        let schedule = Schedule::from_str(schedule_str)
            .map_err(|e| {
                println!("❌ Failed to parse cron schedule: {:?}", e);
                rusqlite::Error::ToSqlConversionFailure(Box::new(e))
            })?;

        println!("✅ Cron schedule parsed successfully");

        let next = schedule.upcoming(chrono::Utc).next()
            .ok_or_else(|| {
                println!("❌ No upcoming execution time found");
                rusqlite::Error::InvalidQuery
            })?;

        println!("✅ Next execution time: {}", next.to_rfc3339());
        Ok(next.to_rfc3339())
    }

    pub fn get_task(&self, task_id: &str) -> Result<Task> {
        let mut stmt = self.conn.prepare(
            "SELECT * FROM tasks WHERE id = ?1"
        )?;

        stmt.query_row(params![task_id], |row| {
            Ok(Task {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                task_type: row.get(3)?,
                status: row.get(4)?,
                enabled: row.get(5)?,
                script_path: row.get(6)?,
                script_content: row.get(7)?,
                script_hash: row.get(8)?,
                schedule: row.get(9)?,
                schedule_type: row.get::<_, Option<String>>(10)?.unwrap_or_else(|| "cron".to_string()),
                interval_seconds: row.get(11)?,
                timeout: row.get(12)?,
                retry_count: row.get(13)?,
                retry_delay: row.get(14)?,
                account_id: row.get(15)?,
                parameters: row.get(16)?,
                last_execution_time: row.get(17)?,
                next_execution_time: row.get(18)?,
                total_executions: row.get(19)?,
                success_count: row.get(20)?,
                failure_count: row.get(21)?,
                average_duration: row.get(22)?,
                created_at: row.get(23)?,
                updated_at: row.get(24)?,
                tags: row.get(25)?,
            })
        })
    }

    pub fn get_all_tasks(&self) -> Result<Vec<Task>> {
        let mut stmt = self.conn.prepare("SELECT * FROM tasks ORDER BY created_at DESC")?;
        let tasks = stmt.query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                task_type: row.get(3)?,
                status: row.get(4)?,
                enabled: row.get(5)?,
                script_path: row.get(6)?,
                script_content: row.get(7)?,
                script_hash: row.get(8)?,
                schedule: row.get(9)?,
                schedule_type: row.get::<_, Option<String>>(10)?.unwrap_or_else(|| "cron".to_string()),
                interval_seconds: row.get(11)?,
                timeout: row.get(12)?,
                retry_count: row.get(13)?,
                retry_delay: row.get(14)?,
                account_id: row.get(15)?,
                parameters: row.get(16)?,
                last_execution_time: row.get(17)?,
                next_execution_time: row.get(18)?,
                total_executions: row.get(19)?,
                success_count: row.get(20)?,
                failure_count: row.get(21)?,
                average_duration: row.get(22)?,
                created_at: row.get(23)?,
                updated_at: row.get(24)?,
                tags: row.get(25)?,
            })
        })?;

        tasks.collect()
    }

    pub fn update_task(&self, task_id: &str, input: TaskConfigInput) -> Result<()> {
        let now = chrono::Utc::now();
        let now_str = now.to_rfc3339();
        let parameters = serde_json::to_string(&input.parameters.unwrap_or(serde_json::json!({})))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let tags = input.tags.map(|t| serde_json::to_string(&t).unwrap());
        let schedule_type = input.schedule_type.as_deref().unwrap_or("cron");

        let next_execution_time = if input.task_type == "scheduled" {
            match schedule_type {
                "interval" => {
                    if let Some(interval_secs) = input.interval_seconds {
                        let next = now + chrono::Duration::seconds(interval_secs);
                        Some(next.to_rfc3339())
                    } else {
                        None
                    }
                }
                "cron" => {
                    input.schedule.as_ref().and_then(|schedule_str| {
                        Self::calculate_next_execution(schedule_str, now).ok()
                    })
                }
                _ => None
            }
        } else {
            None
        };

        self.conn.execute(
            "UPDATE tasks SET
                name = ?1, description = ?2, script_path = ?3, schedule = ?4, schedule_type = ?5, interval_seconds = ?6,
                timeout = ?7, retry_count = ?8, retry_delay = ?9, parameters = ?10,
                tags = ?11, next_execution_time = ?12, updated_at = ?13
            WHERE id = ?14",
            params![
                input.name,
                input.description,
                input.script_path,
                input.schedule,
                schedule_type,
                input.interval_seconds,
                input.timeout,
                input.retry_count,
                input.retry_delay,
                parameters,
                tags,
                next_execution_time,
                now_str,
                task_id,
            ],
        )?;

        Ok(())
    }

    pub fn delete_task(&self, task_id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])?;
        Ok(())
    }

    pub fn update_task_status(&self, task_id: &str, status: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status, now, task_id],
        )?;
        Ok(())
    }

    pub fn update_task_execution_times(&self, task_id: &str, next_execution: Option<String>, last_execution: Option<String>) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE tasks SET next_execution_time = ?1, last_execution_time = ?2, updated_at = ?3 WHERE id = ?4",
            params![next_execution, last_execution, now, task_id],
        )?;
        Ok(())
    }

    pub fn save_execution(&self, result: &ExecutionResult) -> Result<()> {
        self.conn.execute(
            "INSERT INTO executions (
                id, task_id, start_time, end_time, duration, status,
                exit_code, stdout, stderr, metadata
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                result.id,
                result.task_id,
                result.start_time,
                result.end_time,
                result.duration,
                result.status,
                result.exit_code,
                result.stdout,
                result.stderr,
                result.metadata,
            ],
        )?;

        // Update task statistics
        let success = if result.status == "success" { 1 } else { 0 };
        let failure = if result.status == "failure" { 1 } else { 0 };

        self.conn.execute(
            "UPDATE tasks SET
                total_executions = total_executions + 1,
                success_count = success_count + ?1,
                failure_count = failure_count + ?2,
                last_execution_time = ?3,
                updated_at = ?4
            WHERE id = ?5",
            params![success, failure, result.end_time, result.end_time, result.task_id],
        )?;

        Ok(())
    }

    pub fn update_next_execution_time(&self, task_id: &str, task: &Task) -> Result<()> {
        let now = chrono::Utc::now();

        let next_execution_time = match task.schedule_type.as_str() {
            "interval" => {
                // Interval timer with smart catch-up logic
                if let Some(interval_secs) = task.interval_seconds {
                    // If there's a last execution time, calculate based on it
                    if let Some(ref last_exec_str) = task.last_execution_time {
                        if let Ok(last_exec_time) = chrono::DateTime::parse_from_rfc3339(last_exec_str) {
                            let last_exec_utc = last_exec_time.with_timezone(&chrono::Utc);
                            let time_since_last = now.signed_duration_since(last_exec_utc);

                            // Calculate n = floor((now - last_execution) / interval)
                            // This gives us the number of complete intervals that have passed
                            let n = (time_since_last.num_seconds() as f64 / interval_secs as f64).floor() as i64;

                            // Next execution = last_execution + (interval * (n + 1))
                            // This ensures the next execution time is always > current time
                            let next = last_exec_utc + chrono::Duration::seconds(interval_secs * (n + 1));
                            next.to_rfc3339()
                        } else {
                            // Fallback: if parsing fails, use current time + interval
                            let next = now + chrono::Duration::seconds(interval_secs);
                            next.to_rfc3339()
                        }
                    } else {
                        // No last execution: use current time + interval
                        let next = now + chrono::Duration::seconds(interval_secs);
                        next.to_rfc3339()
                    }
                } else {
                    return Err(rusqlite::Error::InvalidQuery);
                }
            }
            "cron" => {
                // Cron timer: calculate next cron time
                if let Some(ref schedule_str) = task.schedule {
                    Self::calculate_next_execution(schedule_str, now)?
                } else {
                    return Err(rusqlite::Error::InvalidQuery);
                }
            }
            _ => return Err(rusqlite::Error::InvalidQuery)
        };

        let rows_affected = self.conn.execute(
            "UPDATE tasks SET next_execution_time = ?1, updated_at = ?2 WHERE id = ?3",
            params![next_execution_time, now.to_rfc3339(), task_id],
        )?;

        eprintln!("📝 Updated {} rows, new next_execution_time: {}", rows_affected, next_execution_time);

        Ok(())
    }

    pub fn recalculate_missed_executions(&self) -> Result<()> {
        let now = chrono::Utc::now();

        eprintln!("🔄 Recalculating next execution times on startup...");

        // Get all scheduled tasks with their schedule_type, interval_seconds, and last_execution_time
        let mut stmt = self.conn.prepare(
            "SELECT id, schedule, schedule_type, interval_seconds, next_execution_time, last_execution_time
             FROM tasks WHERE type = 'scheduled' AND enabled = 1"
        )?;

        let tasks: Vec<(String, Option<String>, String, Option<i64>, Option<String>, Option<String>)> = stmt
            .query_map([], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get::<_, Option<String>>(2)?.unwrap_or_else(|| "cron".to_string()),
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            })?
            .collect::<Result<Vec<_>>>()?;

        for (task_id, schedule_opt, schedule_type, interval_seconds_opt, _next_exec_opt, last_exec_opt) in tasks {
            // For interval tasks, ALWAYS recalculate on startup
            // For cron tasks, only recalculate if next_execution_time is in the past
            let should_recalculate = match schedule_type.as_str() {
                "interval" => true,  // Always recalculate interval tasks
                "cron" => {
                    // Only recalculate cron tasks if next_execution_time is in the past
                    if let Some(next_exec_str) = _next_exec_opt {
                        if let Ok(next_exec_time) = chrono::DateTime::parse_from_rfc3339(&next_exec_str) {
                            let next_exec_utc = next_exec_time.with_timezone(&chrono::Utc);
                            next_exec_utc < now
                        } else {
                            true
                        }
                    } else {
                        true
                    }
                }
                _ => false
            };

            if should_recalculate {
                let new_next_time = match schedule_type.as_str() {
                    "interval" => {
                        // Interval timer: use smart catch-up logic based on last_execution_time
                        if let (Some(interval_secs), Some(last_exec_str)) = (interval_seconds_opt, last_exec_opt) {
                            if let Ok(last_exec_time) = chrono::DateTime::parse_from_rfc3339(&last_exec_str) {
                                let last_exec_utc = last_exec_time.with_timezone(&chrono::Utc);
                                let time_since_last = now.signed_duration_since(last_exec_utc);

                                // Calculate n = floor((now - last_execution) / interval)
                                let n = (time_since_last.num_seconds() as f64 / interval_secs as f64).floor() as i64;

                                // Next execution = last_execution + (interval * (n + 1))
                                let next = last_exec_utc + chrono::Duration::seconds(interval_secs * (n + 1));

                                eprintln!("  📅 Task {}: interval={}s, last_exec={}, next_exec={}",
                                    &task_id[..8], interval_secs, last_exec_str, next.to_rfc3339());

                                Some(next.to_rfc3339())
                            } else {
                                // Fallback: current time + interval
                                let next = now + chrono::Duration::seconds(interval_secs);
                                eprintln!("  📅 Task {}: no valid last_exec, using now + interval", &task_id[..8]);
                                Some(next.to_rfc3339())
                            }
                        } else {
                            eprintln!("  ⚠️  Task {}: missing interval_seconds or last_execution_time", &task_id[..8]);
                            None
                        }
                    }
                    "cron" => {
                        // Cron timer: find next valid cron time
                        if let Some(schedule_str) = schedule_opt {
                            if let Ok(schedule) = Schedule::from_str(&schedule_str) {
                                let next = schedule.upcoming(chrono::Utc).next().map(|t| t.to_rfc3339());
                                eprintln!("  📅 Task {}: cron recalculated", &task_id[..8]);
                                next
                            } else {
                                eprintln!("  ⚠️  Task {}: invalid cron expression", &task_id[..8]);
                                None
                            }
                        } else {
                            eprintln!("  ⚠️  Task {}: missing cron schedule", &task_id[..8]);
                            None
                        }
                    }
                    _ => None
                };

                if let Some(new_time) = new_next_time {
                    self.conn.execute(
                        "UPDATE tasks SET next_execution_time = ?1, updated_at = ?2 WHERE id = ?3",
                        params![new_time, now.to_rfc3339(), task_id],
                    )?;
                }
            }
        }

        eprintln!("✅ Recalculation complete");
        Ok(())
    }

    pub fn get_execution_history(&self, task_id: &str, limit: Option<i64>) -> Result<Vec<ExecutionResult>> {
        let limit = limit.unwrap_or(50);
        let mut stmt = self.conn.prepare(
            "SELECT * FROM executions WHERE task_id = ?1 ORDER BY start_time DESC LIMIT ?2"
        )?;

        let results = stmt.query_map(params![task_id, limit], |row| {
            Ok(ExecutionResult {
                id: row.get(0)?,
                task_id: row.get(1)?,
                start_time: row.get(2)?,
                end_time: row.get(3)?,
                duration: row.get(4)?,
                status: row.get(5)?,
                exit_code: row.get(6)?,
                stdout: row.get(7)?,
                stderr: row.get(8)?,
                metadata: row.get(9)?,
            })
        })?;

        results.collect()
    }
}
