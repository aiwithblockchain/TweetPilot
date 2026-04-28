use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use crate::services::ai_storage::{LoadedSession, SessionMetadata, StoredMessage, StoredTimelineItem, StoredToolCall};
use std::path::PathBuf;
use uuid::Uuid;
use cron::Schedule;
use std::str::FromStr;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub task_type: String,
    pub status: String,
    pub enabled: bool,
    pub execution_mode: String,
    pub use_persona: bool,
    pub persona_prompt: Option<String>,
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
    #[serde(rename = "accountId")]
    pub account_id: String,
    pub parameters: String,
    #[serde(rename = "tweetId")]
    pub tweet_id: Option<String>,
    pub text: Option<String>,
    #[serde(rename = "lastExecutionStatus")]
    pub last_execution_status: Option<String>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionResult {
    pub id: String,
    pub task_id: String,
    pub run_no: Option<i64>,
    pub session_code: Option<String>,
    pub task_session_id: Option<String>,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration: Option<f64>,
    pub status: String,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub final_output: Option<String>,
    pub error_message: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionDetail {
    pub execution: ExecutionResult,
    pub session: Option<LoadedSession>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TaskConfigInput {
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub task_type: String,
    pub execution_mode: Option<String>,
    pub use_persona: Option<bool>,
    pub persona_prompt: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskAiSession {
    pub id: String,
    pub task_id: String,
    pub task_run_id: String,
    pub session_code: String,
    pub title: String,
    pub source_type: String,
    pub working_dir: String,
    pub provider_id: Option<String>,
    pub model: String,
    pub system_prompt: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: usize,
    pub schema_version: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct CreateTaskAiSessionInput {
    pub id: String,
    pub task_id: String,
    pub task_run_id: String,
    pub session_code: String,
    pub title: String,
    pub source_type: String,
    pub working_dir: String,
    pub provider_id: Option<String>,
    pub model: String,
    pub system_prompt: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct XAccountRow {
    pub twitter_id: String,
    pub is_managed: bool,
    pub managed_at: Option<String>,
    pub unmanaged_at: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub personality_prompt: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AccountTrendSnapshot {
    pub id: i64,
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
    pub favourites_count: Option<i64>,
    pub listed_count: Option<i64>,
    pub media_count: Option<i64>,
    pub account_created_at: Option<String>,
    pub last_online_time: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AccountWithLatestSnapshot {
    pub twitter_id: String,
    pub is_managed: bool,
    pub managed_at: Option<String>,
    pub unmanaged_at: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub personality_prompt: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub screen_name: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: Option<bool>,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
    pub favourites_count: Option<i64>,
    pub listed_count: Option<i64>,
    pub media_count: Option<i64>,
    pub account_created_at: Option<String>,
    pub last_online_time: Option<String>,
    pub latest_snapshot_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedAccountForTask {
    pub twitter_id: String,
    pub screen_name: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub personality_prompt: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TaskAiAccountContext {
    pub twitter_id: String,
    pub screen_name: Option<String>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub is_verified: Option<bool>,
    pub latest_snapshot_at: Option<String>,
}

pub struct TaskDatabase {
    conn: Connection,
}

impl TaskDatabase {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        Self::init_schema(&conn)?;
        let db = Self { conn };
        db.validate_schema()?;
        Ok(db)
    }

    fn validate_schema(&self) -> Result<()> {
        let mut stmt = self.conn.prepare("PRAGMA table_info(tasks)")?;
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>>>()?;

        let required_columns = [
            "execution_mode",
            "use_persona",
            "persona_prompt",
        ];

        let missing_columns = required_columns
            .iter()
            .copied()
            .filter(|column| !columns.iter().any(|existing| existing == column))
            .collect::<Vec<_>>();

        if missing_columns.is_empty() {
            return Ok(());
        }

        Err(rusqlite::Error::InvalidColumnName(format!(
            "tasks schema is outdated, missing columns: {}. Delete workspace database and retry.",
            missing_columns.join(", ")
        )))
    }

    fn init_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(include_str!("../migrations/001_create_tasks_tables.sql"))?;
        conn.execute_batch(include_str!("../migrations/002_create_accounts_table.sql"))?;
        conn.execute_batch(include_str!("../migrations/003_create_x_accounts_and_trend.sql"))?;
        conn.execute_batch(include_str!("../migrations/004_create_ai_conversation_tables.sql"))?;
        conn.execute_batch(include_str!("../migrations/005_create_ai_message_timeline_items.sql"))?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(())
    }

    pub fn create_task(&self, input: TaskConfigInput) -> Result<Task> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now();
        let now_str = now.to_rfc3339();
        let parameters = serde_json::to_string(&input.parameters.clone().unwrap_or(serde_json::json!({})))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let tags = input.tags.clone().map(|t| serde_json::to_string(&t).unwrap());

        let schedule_type = input.schedule_type.as_deref().unwrap_or("cron");
        let execution_mode = input.execution_mode.as_deref().unwrap_or("script");
        let use_persona = input.use_persona.unwrap_or(false);

        // Calculate next_execution_time for scheduled tasks
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
                execution_mode, use_persona, persona_prompt,
                script_path, schedule, schedule_type, interval_seconds, timeout, retry_count, retry_delay,
                account_id, parameters, tweet_id, text, tags, next_execution_time, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
            params![
                id,
                input.name,
                input.description,
                input.task_type,
                "idle",
                true,
                execution_mode,
                use_persona,
                input.persona_prompt,
                input.script_path,
                input.schedule,
                schedule_type,
                input.interval_seconds,
                input.timeout,
                input.retry_count,
                input.retry_delay,
                input.account_id,
                parameters,
                None::<String>,
                None::<String>,
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
                execution_mode: row.get(6)?,
                use_persona: row.get(7)?,
                persona_prompt: row.get(8)?,
                script_path: row.get(9)?,
                script_content: row.get(10)?,
                script_hash: row.get(11)?,
                schedule: row.get(12)?,
                schedule_type: row.get::<_, Option<String>>(13)?.unwrap_or_else(|| "cron".to_string()),
                interval_seconds: row.get(14)?,
                timeout: row.get(15)?,
                retry_count: row.get(16)?,
                retry_delay: row.get(17)?,
                account_id: row.get(18)?,
                parameters: row.get(19)?,
                tweet_id: row.get(20)?,
                text: row.get(21)?,
                last_execution_status: row.get(22)?,
                last_execution_time: row.get(23)?,
                next_execution_time: row.get(24)?,
                total_executions: row.get(25)?,
                success_count: row.get(26)?,
                failure_count: row.get(27)?,
                average_duration: row.get(28)?,
                created_at: row.get(29)?,
                updated_at: row.get(30)?,
                tags: row.get(31)?,
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
                execution_mode: row.get(6)?,
                use_persona: row.get(7)?,
                persona_prompt: row.get(8)?,
                script_path: row.get(9)?,
                script_content: row.get(10)?,
                script_hash: row.get(11)?,
                schedule: row.get(12)?,
                schedule_type: row.get::<_, Option<String>>(13)?.unwrap_or_else(|| "cron".to_string()),
                interval_seconds: row.get(14)?,
                timeout: row.get(15)?,
                retry_count: row.get(16)?,
                retry_delay: row.get(17)?,
                account_id: row.get(18)?,
                parameters: row.get(19)?,
                tweet_id: row.get(20)?,
                text: row.get(21)?,
                last_execution_status: row.get(22)?,
                last_execution_time: row.get(23)?,
                next_execution_time: row.get(24)?,
                total_executions: row.get(25)?,
                success_count: row.get(26)?,
                failure_count: row.get(27)?,
                average_duration: row.get(28)?,
                created_at: row.get(29)?,
                updated_at: row.get(30)?,
                tags: row.get(31)?,
            })
        })?;

        tasks.collect()
    }

    pub fn update_task(&self, task_id: &str, input: TaskConfigInput) -> Result<()> {
        let now = chrono::Utc::now();
        let now_str = now.to_rfc3339();
        let parameters = serde_json::to_string(&input.parameters.clone().unwrap_or(serde_json::json!({})))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let tags = input.tags.clone().map(|t| serde_json::to_string(&t).unwrap());
        let schedule_type = input.schedule_type.as_deref().unwrap_or("cron");
        let execution_mode = input.execution_mode.as_deref().unwrap_or("script");
        let use_persona = input.use_persona.unwrap_or(false);

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
                name = ?1, description = ?2, type = ?3, execution_mode = ?4, use_persona = ?5, persona_prompt = ?6,
                script_path = ?7, schedule = ?8, schedule_type = ?9, interval_seconds = ?10,
                timeout = ?11, retry_count = ?12, retry_delay = ?13, account_id = ?14, parameters = ?15,
                tags = ?16, next_execution_time = ?17, updated_at = ?18
            WHERE id = ?19",
            params![
                input.name,
                input.description,
                input.task_type,
                execution_mode,
                use_persona,
                input.persona_prompt,
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
                task_id,
            ],
        )?;

        Ok(())
    }

    pub fn delete_task(&self, task_id: &str) -> Result<()> {
        self.clear_task_execution_history(task_id)?;
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
                id, task_id, run_no, session_code, task_session_id, start_time, end_time, duration, status,
                exit_code, stdout, stderr, final_output, error_message, metadata
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                result.id,
                result.task_id,
                result.run_no,
                result.session_code,
                result.task_session_id,
                result.start_time,
                result.end_time,
                result.duration,
                result.status,
                result.exit_code,
                result.stdout,
                result.stderr,
                result.final_output,
                result.error_message,
                result.metadata,
            ],
        )?;

        let normalized_status = if result.status == "failed" { "failure" } else { result.status.as_str() };
        let success = if normalized_status == "success" { 1 } else { 0 };
        let failure = if normalized_status == "failure" { 1 } else { 0 };

        self.conn.execute(
            "UPDATE tasks SET
                total_executions = total_executions + 1,
                success_count = success_count + ?1,
                failure_count = failure_count + ?2,
                last_execution_status = ?3,
                last_execution_time = ?4,
                updated_at = ?5
            WHERE id = ?6",
            params![success, failure, normalized_status, result.end_time, result.end_time, result.task_id],
        )?;

        Ok(())
    }

    pub fn get_next_run_no(&self, task_id: &str) -> Result<i64> {
        let next_run_no = self.conn.query_row(
            "SELECT COALESCE(MAX(run_no), 0) + 1 FROM executions WHERE task_id = ?1",
            params![task_id],
            |row| row.get(0),
        )?;
        Ok(next_run_no)
    }

    pub fn create_execution_stub(&self, execution_id: &str, task_id: &str, run_no: Option<i64>, start_time: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO executions (
                id, task_id, run_no, session_code, task_session_id, start_time, end_time, duration, status,
                exit_code, stdout, stderr, final_output, error_message, metadata
            ) VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL, NULL, 'running', NULL, '', '', NULL, NULL, NULL)",
            params![execution_id, task_id, run_no, start_time],
        )?;
        Ok(())
    }

    pub fn finalize_execution(&self, result: &ExecutionResult) -> Result<()> {
        self.conn.execute(
            "UPDATE executions SET
                run_no = ?2,
                session_code = ?3,
                task_session_id = ?4,
                start_time = ?5,
                end_time = ?6,
                duration = ?7,
                status = ?8,
                exit_code = ?9,
                stdout = ?10,
                stderr = ?11,
                final_output = ?12,
                error_message = ?13,
                metadata = ?14
            WHERE id = ?1",
            params![
                result.id,
                result.run_no,
                result.session_code,
                result.task_session_id,
                result.start_time,
                result.end_time,
                result.duration,
                result.status,
                result.exit_code,
                result.stdout,
                result.stderr,
                result.final_output,
                result.error_message,
                result.metadata,
            ],
        )?;

        let normalized_status = if result.status == "failed" { "failure" } else { result.status.as_str() };
        let success = if normalized_status == "success" { 1 } else { 0 };
        let failure = if normalized_status == "failure" { 1 } else { 0 };
        let execution_time = result.end_time.as_ref().unwrap_or(&result.start_time);

        self.conn.execute(
            "UPDATE tasks SET
                status = 'idle',
                total_executions = total_executions + 1,
                success_count = success_count + ?1,
                failure_count = failure_count + ?2,
                last_execution_status = ?3,
                last_execution_time = ?4,
                updated_at = ?5
            WHERE id = ?6",
            params![success, failure, normalized_status, execution_time, execution_time, result.task_id],
        )?;

        Ok(())
    }

    pub fn mark_task_and_execution_failed(&self, task_id: &str, execution_id: &str, error_message: &str) -> Result<()> {
        let timestamp = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "UPDATE executions SET
                end_time = COALESCE(end_time, ?3),
                duration = COALESCE(duration, 0),
                status = 'failure',
                exit_code = COALESCE(exit_code, 1),
                stderr = CASE
                    WHEN stderr IS NULL OR stderr = '' THEN ?2
                    ELSE stderr
                END,
                error_message = COALESCE(error_message, ?2)
            WHERE id = ?1 AND status = 'running'",
            params![execution_id, error_message, timestamp],
        )?;

        self.conn.execute(
            "UPDATE tasks SET
                status = 'idle',
                last_execution_status = COALESCE(last_execution_status, 'failure'),
                last_execution_time = COALESCE(last_execution_time, ?2),
                updated_at = ?2
            WHERE id = ?1",
            params![task_id, timestamp],
        )?;

        Ok(())
    }

    pub fn get_execution_by_id(&self, execution_id: &str) -> Result<ExecutionResult> {
        self.conn.query_row(
            "SELECT id, task_id, run_no, session_code, task_session_id, start_time, end_time, duration, status,
                    exit_code, stdout, stderr, final_output, error_message, metadata
             FROM executions WHERE id = ?1",
            params![execution_id],
            |row| {
                Ok(ExecutionResult {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    run_no: row.get(2)?,
                    session_code: row.get(3)?,
                    task_session_id: row.get(4)?,
                    start_time: row.get(5)?,
                    end_time: row.get(6)?,
                    duration: row.get(7)?,
                    status: row.get(8)?,
                    exit_code: row.get(9)?,
                    stdout: row.get(10)?,
                    stderr: row.get(11)?,
                    final_output: row.get(12)?,
                    error_message: row.get(13)?,
                    metadata: row.get(14)?,
                })
            },
        )
    }

    pub fn get_execution_detail(&self, execution_id: &str) -> Result<ExecutionDetail> {
        let execution = self.get_execution_by_id(execution_id)?;
        let session = match execution.task_session_id.as_deref() {
            Some(session_id) => Some(self.load_task_ai_session(session_id)?),
            None => None,
        };

        Ok(ExecutionDetail { execution, session })
    }

    pub fn update_execution_session_link(&self, execution_id: &str, task_session_id: &str, session_code: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE executions SET task_session_id = ?2, session_code = ?3 WHERE id = ?1",
            params![execution_id, task_session_id, session_code],
        )?;
        Ok(())
    }

    pub fn delete_task_execution_history(&self, task_id: &str) -> Result<()> {
        let mut stmt = self.conn.prepare(
            "SELECT id FROM task_ai_sessions WHERE task_id = ?1"
        )?;
        let session_ids = stmt
            .query_map(params![task_id], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>>>()?;

        for session_id in session_ids {
            self.delete_task_ai_session(&session_id)?;
        }

        self.conn.execute("DELETE FROM executions WHERE task_id = ?1", params![task_id])?;
        self.conn.execute(
            "UPDATE tasks SET
                total_executions = 0,
                success_count = 0,
                failure_count = 0,
                average_duration = 0,
                last_execution_status = NULL,
                last_execution_time = NULL,
                updated_at = ?2
            WHERE id = ?1",
            params![task_id, chrono::Utc::now().to_rfc3339()],
        )?;
        Ok(())
    }

    pub fn create_task_ai_session(&self, input: CreateTaskAiSessionInput) -> Result<TaskAiSession> {
        self.conn.execute(
            "INSERT INTO task_ai_sessions (
                id, task_id, task_run_id, session_code, title, source_type, working_dir,
                provider_id, model, system_prompt, created_at, updated_at, message_count, schema_version
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 0, ?13)",
            params![
                input.id,
                input.task_id,
                input.task_run_id,
                input.session_code,
                input.title,
                input.source_type,
                input.working_dir,
                input.provider_id,
                input.model,
                input.system_prompt,
                input.created_at,
                input.updated_at,
                5u32,
            ],
        )?;

        self.get_task_ai_session_metadata(&input.id)
    }

    pub fn get_task_ai_session_metadata(&self, session_id: &str) -> Result<TaskAiSession> {
        self.conn.query_row(
            "SELECT id, task_id, task_run_id, session_code, title, source_type, working_dir,
                    provider_id, model, system_prompt, created_at, updated_at, message_count, schema_version
             FROM task_ai_sessions WHERE id = ?1",
            params![session_id],
            |row| {
                Ok(TaskAiSession {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    task_run_id: row.get(2)?,
                    session_code: row.get(3)?,
                    title: row.get(4)?,
                    source_type: row.get(5)?,
                    working_dir: row.get(6)?,
                    provider_id: row.get(7)?,
                    model: row.get(8)?,
                    system_prompt: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                    message_count: row.get::<_, i64>(12)? as usize,
                    schema_version: row.get(13)?,
                })
            },
        )
    }

    pub fn load_task_ai_session(&self, session_id: &str) -> Result<LoadedSession> {
        let session = self.get_task_ai_session_metadata(session_id)?;
        let messages = self.load_task_ai_messages(session_id)?;
        Ok(LoadedSession {
            session: SessionMetadata {
                id: session.id,
                title: session.title,
                created_at: session.created_at,
                updated_at: session.updated_at,
                message_count: session.message_count,
                workspace: session.working_dir,
                schema_version: session.schema_version,
            },
            messages,
        })
    }

    pub fn load_task_ai_messages(&self, session_id: &str) -> Result<Vec<StoredMessage>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, role, content, timestamp, thinking, thinking_complete, status
             FROM task_ai_messages WHERE session_id = ?1 ORDER BY timestamp ASC, id ASC"
        )?;

        let rows = stmt.query_map(params![session_id], |row| {
            let message_id: String = row.get(0)?;
            Ok(StoredMessage {
                id: Some(message_id),
                role: row.get(1)?,
                content: row.get(2)?,
                timestamp: row.get(3)?,
                thinking: row.get(4)?,
                thinking_complete: row.get(5)?,
                tool_calls: None,
                timeline: None,
                status: row.get(6)?,
            })
        })?;

        let mut messages = rows.collect::<Result<Vec<_>>>()?;
        for message in &mut messages {
            if let Some(message_id) = message.id.as_deref() {
                let tool_calls = self.load_task_ai_tool_calls(message_id)?;
                if !tool_calls.is_empty() {
                    message.tool_calls = Some(tool_calls);
                }
                let timeline = self.load_task_ai_timeline_items(message_id)?;
                if !timeline.is_empty() {
                    message.timeline = Some(timeline);
                }
            }
        }

        Ok(messages)
    }

    fn load_task_ai_tool_calls(&self, message_id: &str) -> Result<Vec<StoredToolCall>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, tool, action, input, output, status, duration, start_time, end_time
             FROM task_ai_tool_calls WHERE message_id = ?1 ORDER BY start_time ASC, id ASC"
        )?;

        let rows = stmt.query_map(params![message_id], |row| {
            Ok(StoredToolCall {
                id: row.get(0)?,
                tool: row.get(1)?,
                action: row.get(2)?,
                input: row.get(3)?,
                output: row.get(4)?,
                status: row.get(5)?,
                duration: row.get(6)?,
                start_time: row.get(7)?,
                end_time: row.get(8)?,
            })
        })?;

        rows.collect()
    }

    fn load_task_ai_timeline_items(&self, message_id: &str) -> Result<Vec<StoredTimelineItem>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, type, sequence, content, tool_call_id, is_complete
             FROM task_ai_message_timeline_items WHERE message_id = ?1 ORDER BY sequence ASC, id ASC"
        )?;

        let rows = stmt.query_map(params![message_id], |row| {
            let item_type: String = row.get(1)?;
            let id: String = row.get(0)?;
            let sequence: i64 = row.get(2)?;
            let content: Option<String> = row.get(3)?;
            let tool_call_id: Option<String> = row.get(4)?;
            let is_complete: Option<bool> = row.get(5)?;

            match item_type.as_str() {
                "thinking" => Ok(StoredTimelineItem::Thinking {
                    id,
                    content: content.unwrap_or_default(),
                    sequence,
                    is_complete,
                }),
                "tool" => Ok(StoredTimelineItem::Tool {
                    id,
                    tool_call_id: tool_call_id.unwrap_or_default(),
                    sequence,
                }),
                _ => Ok(StoredTimelineItem::Text {
                    id,
                    content: content.unwrap_or_default(),
                    sequence,
                }),
            }
        })?;

        rows.collect()
    }

    pub fn insert_task_ai_message(&self, session_id: &str, message: &StoredMessage) -> Result<()> {
        let message_id = message.id.clone().ok_or(rusqlite::Error::InvalidQuery)?;
        self.conn.execute(
            "INSERT INTO task_ai_messages (id, session_id, role, content, timestamp, thinking, thinking_complete, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                message_id,
                session_id,
                message.role,
                message.content,
                message.timestamp,
                message.thinking,
                message.thinking_complete,
                message.status,
            ],
        )?;
        self.replace_task_ai_tool_calls(&message_id, message.tool_calls.as_deref().unwrap_or(&[]))?;
        self.replace_task_ai_timeline_items(&message_id, message.timeline.as_deref().unwrap_or(&[]))?;
        self.refresh_task_ai_session_metadata(session_id)
    }

    pub fn append_task_ai_message_content(&self, message_id: &str, chunk: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE task_ai_messages SET content = content || ?2 WHERE id = ?1",
            params![message_id, chunk],
        )?;
        Ok(())
    }

    pub fn update_task_ai_message_thinking(&self, message_id: &str, thinking: &str, thinking_complete: Option<bool>) -> Result<()> {
        self.conn.execute(
            "UPDATE task_ai_messages SET thinking = ?2, thinking_complete = COALESCE(?3, thinking_complete) WHERE id = ?1",
            params![message_id, thinking, thinking_complete],
        )?;
        Ok(())
    }

    pub fn update_task_ai_message_status(&self, message_id: &str, status: Option<&str>) -> Result<()> {
        self.conn.execute(
            "UPDATE task_ai_messages SET status = ?2 WHERE id = ?1",
            params![message_id, status],
        )?;
        Ok(())
    }

    pub fn finalize_task_ai_message(&self, session_id: &str, message: &StoredMessage) -> Result<()> {
        let message_id = message.id.clone().ok_or(rusqlite::Error::InvalidQuery)?;
        self.conn.execute(
            "UPDATE task_ai_messages SET content = ?2, thinking = ?3, thinking_complete = ?4, status = ?5, timestamp = ?6 WHERE id = ?1",
            params![message_id, message.content, message.thinking, message.thinking_complete, message.status, message.timestamp],
        )?;
        self.replace_task_ai_tool_calls(&message_id, message.tool_calls.as_deref().unwrap_or(&[]))?;
        self.replace_task_ai_timeline_items(&message_id, message.timeline.as_deref().unwrap_or(&[]))?;
        self.refresh_task_ai_session_metadata(session_id)
    }

    pub fn delete_task_ai_session(&self, session_id: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE executions SET task_session_id = NULL, session_code = NULL WHERE task_session_id = ?1",
            params![session_id],
        )?;
        self.conn.execute("DELETE FROM task_ai_sessions WHERE id = ?1", params![session_id])?;
        Ok(())
    }

    pub fn clear_task_execution_history(&self, task_id: &str) -> Result<()> {
        self.delete_task_execution_history(task_id)
    }

    fn replace_task_ai_tool_calls(&self, message_id: &str, tool_calls: &[StoredToolCall]) -> Result<()> {
        self.conn.execute("DELETE FROM task_ai_tool_calls WHERE message_id = ?1", params![message_id])?;
        for tool_call in tool_calls {
            self.conn.execute(
                "INSERT INTO task_ai_tool_calls (id, message_id, tool, action, input, output, status, duration, start_time, end_time)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    tool_call.id,
                    message_id,
                    tool_call.tool,
                    tool_call.action,
                    tool_call.input,
                    tool_call.output,
                    tool_call.status,
                    tool_call.duration,
                    tool_call.start_time,
                    tool_call.end_time,
                ],
            )?;
        }
        Ok(())
    }

    fn replace_task_ai_timeline_items(&self, message_id: &str, items: &[StoredTimelineItem]) -> Result<()> {
        self.conn.execute("DELETE FROM task_ai_message_timeline_items WHERE message_id = ?1", params![message_id])?;
        for item in items {
            match item {
                StoredTimelineItem::Thinking { id, content, sequence, is_complete } => {
                    self.conn.execute(
                        "INSERT INTO task_ai_message_timeline_items (id, message_id, type, sequence, content, tool_call_id, is_complete)
                         VALUES (?1, ?2, 'thinking', ?3, ?4, NULL, ?5)",
                        params![id, message_id, sequence, content, is_complete],
                    )?;
                }
                StoredTimelineItem::Tool { id, tool_call_id, sequence } => {
                    self.conn.execute(
                        "INSERT INTO task_ai_message_timeline_items (id, message_id, type, sequence, content, tool_call_id, is_complete)
                         VALUES (?1, ?2, 'tool', ?3, NULL, ?4, NULL)",
                        params![id, message_id, sequence, tool_call_id],
                    )?;
                }
                StoredTimelineItem::Text { id, content, sequence } => {
                    self.conn.execute(
                        "INSERT INTO task_ai_message_timeline_items (id, message_id, type, sequence, content, tool_call_id, is_complete)
                         VALUES (?1, ?2, 'text', ?3, ?4, NULL, NULL)",
                        params![id, message_id, sequence, content],
                    )?;
                }
            }
        }
        Ok(())
    }

    fn refresh_task_ai_session_metadata(&self, session_id: &str) -> Result<()> {
        let message_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM task_ai_messages WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )?;

        let updated_at = if message_count == 0 {
            chrono::Utc::now().timestamp()
        } else {
            self.conn.query_row(
                "SELECT MAX(timestamp) FROM task_ai_messages WHERE session_id = ?1",
                params![session_id],
                |row| row.get(0),
            )?
        };

        let title = self.conn.query_row(
            "SELECT content FROM task_ai_messages WHERE session_id = ?1 AND role = 'user' ORDER BY timestamp ASC, id ASC LIMIT 1",
            params![session_id],
            |row| row.get::<_, String>(0),
        ).optional()?.map(|content| {
            let chars: Vec<char> = content.chars().collect();
            if chars.len() <= 50 { content } else { chars.iter().take(50).collect::<String>() + "..." }
        }).unwrap_or_else(|| "新会话".to_string());

        self.conn.execute(
            "UPDATE task_ai_sessions SET title = ?2, message_count = ?3, updated_at = ?4 WHERE id = ?1",
            params![session_id, title, message_count, updated_at],
        )?;
        Ok(())
    }

    pub fn update_next_execution_time(&self, task_id: &str, task: &Task) -> Result<()> {
        log::info!("[update_next_execution_time] Starting for task: {}, schedule_type: {}", task_id, task.schedule_type);
        let now = chrono::Utc::now();

        let next_execution_time = match task.schedule_type.as_str() {
            "interval" => {
                if let Some(interval_secs) = task.interval_seconds {
                    if let Some(ref last_exec_str) = task.last_execution_time {
                        if let Ok(last_exec_time) = chrono::DateTime::parse_from_rfc3339(last_exec_str) {
                            let last_exec_utc = last_exec_time.with_timezone(&chrono::Utc);
                            let time_since_last = now.signed_duration_since(last_exec_utc);
                            let n = (time_since_last.num_seconds() as f64 / interval_secs as f64).floor() as i64;
                            let next = last_exec_utc + chrono::Duration::seconds(interval_secs * (n + 1));
                            next.to_rfc3339()
                        } else {
                            let next = now + chrono::Duration::seconds(interval_secs);
                            next.to_rfc3339()
                        }
                    } else {
                        let next = now + chrono::Duration::seconds(interval_secs);
                        next.to_rfc3339()
                    }
                } else {
                    return Err(rusqlite::Error::InvalidQuery);
                }
            }
            "cron" => {
                if let Some(ref schedule_str) = task.schedule {
                    Self::calculate_next_execution(schedule_str, now)?
                } else {
                    return Err(rusqlite::Error::InvalidQuery);
                }
            }
            _ => return Err(rusqlite::Error::InvalidQuery)
        };

        log::info!("[update_next_execution_time] Calculated next_execution_time: {}", next_execution_time);

        let rows_affected = self.conn.execute(
            "UPDATE tasks SET next_execution_time = ?1, updated_at = ?2 WHERE id = ?3",
            params![next_execution_time, now.to_rfc3339(), task_id],
        )?;

        log::info!("[update_next_execution_time] Updated {} rows, new next_execution_time: {}", rows_affected, next_execution_time);

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
            "SELECT id, task_id, run_no, session_code, task_session_id, start_time, end_time, duration, status,
                    exit_code, stdout, stderr, final_output, error_message, metadata
             FROM executions WHERE task_id = ?1 ORDER BY start_time DESC LIMIT ?2"
        )?;

        let results = stmt.query_map(params![task_id, limit], |row| {
            Ok(ExecutionResult {
                id: row.get(0)?,
                task_id: row.get(1)?,
                run_no: row.get(2)?,
                session_code: row.get(3)?,
                task_session_id: row.get(4)?,
                start_time: row.get(5)?,
                end_time: row.get(6)?,
                duration: row.get(7)?,
                status: row.get(8)?,
                exit_code: row.get(9)?,
                stdout: row.get(10)?,
                stderr: row.get(11)?,
                final_output: row.get(12)?,
                error_message: row.get(13)?,
                metadata: row.get(14)?,
            })
        })?;

        results.collect()
    }

    // Account management methods
    #[allow(dead_code)]
    pub fn account_exists(&self, twitter_id: &str) -> Result<bool> {
        let mut stmt = self.conn.prepare(
            "SELECT EXISTS(SELECT 1 FROM x_accounts WHERE twitter_id = ?1)"
        )?;

        let exists: i64 = stmt.query_row(params![twitter_id], |row| row.get(0))?;
        Ok(exists == 1)
    }

    #[allow(dead_code)]
    pub fn is_account_managed(&self, twitter_id: &str) -> Result<bool> {
        let mut stmt = self.conn.prepare(
            "SELECT EXISTS(SELECT 1 FROM x_accounts WHERE twitter_id = ?1 AND is_managed = 1)"
        )?;

        let exists: i64 = stmt.query_row(params![twitter_id], |row| row.get(0))?;
        Ok(exists == 1)
    }

    pub fn add_account_to_management(&self, account: &crate::models::twitter_account::TwitterBasicAccount) -> Result<()> {
        log::info!("[DB] add_account_to_management START for twitter_id: {}", account.twitter_id);
        let now = chrono::Utc::now().to_rfc3339();

        log::info!("[DB] Inserting into x_accounts table");
        self.conn.execute(
            "INSERT INTO x_accounts (
                twitter_id, is_managed, managed_at, unmanaged_at, instance_id, extension_name,
                created_at, updated_at
            ) VALUES (?1, 1, ?2, NULL, ?3, ?4, ?5, ?6)
            ON CONFLICT(twitter_id) DO UPDATE SET
                is_managed = 1,
                managed_at = excluded.managed_at,
                unmanaged_at = NULL,
                instance_id = excluded.instance_id,
                extension_name = excluded.extension_name,
                updated_at = excluded.updated_at",
            params![
                account.twitter_id,
                now,
                account.instance_id,
                account.extension_name,
                now,
                now,
            ],
        )?;
        log::info!("[DB] x_accounts insert successful");

        // Insert initial snapshot to x_account_trend table
        log::info!("[DB] Inserting initial snapshot into x_account_trend table");
        self.insert_account_snapshot(account)?;
        log::info!("[DB] x_account_trend insert successful");

        log::info!("[DB] add_account_to_management SUCCESS");
        Ok(())
    }

    pub fn remove_account_from_management(&self, twitter_id: &str) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "UPDATE x_accounts SET
                is_managed = 0,
                unmanaged_at = ?2,
                updated_at = ?2
            WHERE twitter_id = ?1",
            params![twitter_id, now],
        )?;

        Ok(())
    }

    pub fn update_account_instance_binding(
        &self,
        twitter_id: &str,
        instance_id: Option<&str>,
        extension_name: Option<&str>,
    ) -> Result<bool> {
        let now = chrono::Utc::now().to_rfc3339();
        let affected = self.conn.execute(
            "UPDATE x_accounts SET
                instance_id = ?2,
                extension_name = ?3,
                updated_at = ?4
            WHERE twitter_id = ?1
              AND (
                COALESCE(instance_id, '') != COALESCE(?2, '')
                OR COALESCE(extension_name, '') != COALESCE(?3, '')
              )",
            params![twitter_id, instance_id, extension_name, now],
        )?;

        Ok(affected > 0)
    }

    pub fn update_account_personality_prompt(&self, twitter_id: &str, personality_prompt: Option<&str>) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "UPDATE x_accounts SET
                personality_prompt = ?2,
                updated_at = ?3
            WHERE twitter_id = ?1",
            params![twitter_id, personality_prompt, now],
        )?;
        Ok(())
    }

    pub fn get_account_management_detail(&self, twitter_id: &str) -> Result<Option<XAccountRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT twitter_id, is_managed, managed_at, unmanaged_at, instance_id, extension_name,
                    personality_prompt, created_at, updated_at
             FROM x_accounts
             WHERE twitter_id = ?1"
        )?;

        let result = stmt.query_row(params![twitter_id], |row| {
            Ok(XAccountRow {
                twitter_id: row.get(0)?,
                is_managed: row.get(1)?,
                managed_at: row.get(2)?,
                unmanaged_at: row.get(3)?,
                instance_id: row.get(4)?,
                extension_name: row.get(5)?,
                personality_prompt: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        });

        match result {
            Ok(account) => Ok(Some(account)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn get_managed_accounts(&self) -> Result<Vec<XAccountRow>> {
        let mut stmt = self.conn.prepare(
            "SELECT twitter_id, is_managed, managed_at, unmanaged_at, instance_id, extension_name,
                    personality_prompt, created_at, updated_at
             FROM x_accounts
             WHERE is_managed = 1
             ORDER BY COALESCE(managed_at, created_at) DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(XAccountRow {
                twitter_id: row.get(0)?,
                is_managed: row.get(1)?,
                managed_at: row.get(2)?,
                unmanaged_at: row.get(3)?,
                instance_id: row.get(4)?,
                extension_name: row.get(5)?,
                personality_prompt: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;

        rows.collect()
    }

    pub fn delete_account_completely(&self, twitter_id: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM x_accounts WHERE twitter_id = ?1",
            params![twitter_id],
        )?;
        Ok(())
    }

    pub fn insert_account_snapshot(&self, account: &crate::models::twitter_account::TwitterBasicAccount) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT INTO x_account_trend (
                twitter_id, screen_name, display_name, avatar_url, description,
                is_verified, followers_count, following_count, tweet_count,
                favourites_count, listed_count, media_count, account_created_at,
                last_online_time, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                account.twitter_id,
                account.screen_name,
                account.display_name,
                account.avatar_url,
                account.description,
                account.is_verified,
                account.followers_count,
                account.following_count,
                account.tweet_count,
                account.favourites_count,
                account.listed_count,
                account.media_count,
                account.created_at,
                account.last_seen.to_rfc3339(),
                now.clone(),
                now,
            ],
        )?;

        Ok(())
    }

    pub fn update_account_snapshot(&self, account: &crate::models::twitter_account::TwitterBasicAccount) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "UPDATE x_account_trend SET
                screen_name = ?2,
                display_name = ?3,
                avatar_url = ?4,
                description = ?5,
                is_verified = ?6,
                followers_count = ?7,
                following_count = ?8,
                tweet_count = ?9,
                favourites_count = ?10,
                listed_count = ?11,
                media_count = ?12,
                account_created_at = ?13,
                last_online_time = ?14,
                updated_at = ?15
            WHERE twitter_id = ?1
            AND id = (SELECT id FROM x_account_trend WHERE twitter_id = ?1 ORDER BY created_at DESC LIMIT 1)",
            params![
                account.twitter_id,
                account.screen_name,
                account.display_name,
                account.avatar_url,
                account.description,
                account.is_verified,
                account.followers_count,
                account.following_count,
                account.tweet_count,
                account.favourites_count,
                account.listed_count,
                account.media_count,
                account.created_at,
                account.last_seen.to_rfc3339(),
                now,
            ],
        )?;

        Ok(())
    }

    pub fn get_latest_account_snapshot(&self, twitter_id: &str) -> Result<Option<AccountTrendSnapshot>> {
        log::info!("[DB] get_latest_account_snapshot START for twitter_id: {}", twitter_id);

        let mut stmt = self.conn.prepare(
            "SELECT id, twitter_id, screen_name, display_name, avatar_url, description,
                    is_verified, followers_count, following_count, tweet_count,
                    favourites_count, listed_count, media_count, account_created_at,
                    last_online_time, created_at
             FROM x_account_trend
             WHERE twitter_id = ?1
             ORDER BY created_at DESC, id DESC
             LIMIT 1"
        )?;

        log::info!("[DB] Executing query for twitter_id: {}", twitter_id);
        let result = stmt.query_row(params![twitter_id], |row| {
            log::info!("[DB] Found row in x_account_trend");
            Ok(AccountTrendSnapshot {
                id: row.get(0)?,
                twitter_id: row.get(1)?,
                screen_name: row.get(2)?,
                display_name: row.get(3)?,
                avatar_url: row.get(4)?,
                description: row.get(5)?,
                is_verified: row.get(6)?,
                followers_count: row.get(7)?,
                following_count: row.get(8)?,
                tweet_count: row.get(9)?,
                favourites_count: row.get(10)?,
                listed_count: row.get(11)?,
                media_count: row.get(12)?,
                account_created_at: row.get(13)?,
                last_online_time: row.get(14)?,
                created_at: row.get(15)?,
            })
        });

        match result {
            Ok(snapshot) => Ok(Some(snapshot)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn get_account_snapshots(&self, twitter_id: &str, limit: Option<i64>) -> Result<Vec<AccountTrendSnapshot>> {
        let limit = limit.unwrap_or(50);
        let mut stmt = self.conn.prepare(
            "SELECT id, twitter_id, screen_name, display_name, avatar_url, description,
                    is_verified, followers_count, following_count, tweet_count,
                    favourites_count, listed_count, media_count, account_created_at,
                    last_online_time, created_at
             FROM x_account_trend
             WHERE twitter_id = ?1
             ORDER BY created_at DESC, id DESC
             LIMIT ?2"
        )?;

        let rows = stmt.query_map(params![twitter_id, limit], |row| {
            Ok(AccountTrendSnapshot {
                id: row.get(0)?,
                twitter_id: row.get(1)?,
                screen_name: row.get(2)?,
                display_name: row.get(3)?,
                avatar_url: row.get(4)?,
                description: row.get(5)?,
                is_verified: row.get(6)?,
                followers_count: row.get(7)?,
                following_count: row.get(8)?,
                tweet_count: row.get(9)?,
                favourites_count: row.get(10)?,
                listed_count: row.get(11)?,
                media_count: row.get(12)?,
                account_created_at: row.get(13)?,
                last_online_time: row.get(14)?,
                created_at: row.get(15)?,
            })
        })?;

        rows.collect()
    }

    pub fn get_account_last_snapshot_time(&self, twitter_id: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT created_at FROM x_account_trend WHERE twitter_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 1"
        )?;

        let result = stmt.query_row(params![twitter_id], |row| row.get(0));

        match result {
            Ok(time) => Ok(Some(time)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn get_managed_accounts_with_latest_snapshot(&self) -> Result<Vec<AccountWithLatestSnapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT
                a.twitter_id,
                a.is_managed,
                a.managed_at,
                a.unmanaged_at,
                a.instance_id,
                a.extension_name,
                a.personality_prompt,
                a.created_at,
                a.updated_at,
                t.screen_name,
                t.display_name,
                t.avatar_url,
                t.description,
                t.is_verified,
                t.followers_count,
                t.following_count,
                t.tweet_count,
                t.favourites_count,
                t.listed_count,
                t.media_count,
                t.account_created_at,
                t.last_online_time,
                t.created_at AS latest_snapshot_at
             FROM x_accounts a
             LEFT JOIN (
                SELECT twitter_id, screen_name, display_name, avatar_url, description,
                       is_verified, followers_count, following_count, tweet_count,
                       favourites_count, listed_count, media_count, account_created_at,
                       last_online_time, created_at,
                       ROW_NUMBER() OVER (PARTITION BY twitter_id ORDER BY created_at DESC, id DESC) AS rn
                FROM x_account_trend
             ) t ON a.twitter_id = t.twitter_id AND t.rn = 1
             WHERE a.is_managed = 1
             ORDER BY COALESCE(t.created_at, a.updated_at) DESC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(AccountWithLatestSnapshot {
                twitter_id: row.get(0)?,
                is_managed: row.get(1)?,
                managed_at: row.get(2)?,
                unmanaged_at: row.get(3)?,
                instance_id: row.get(4)?,
                extension_name: row.get(5)?,
                personality_prompt: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                screen_name: row.get(9)?,
                display_name: row.get(10)?,
                avatar_url: row.get(11)?,
                description: row.get(12)?,
                is_verified: row.get(13)?,
                followers_count: row.get(14)?,
                following_count: row.get(15)?,
                tweet_count: row.get(16)?,
                favourites_count: row.get(17)?,
                listed_count: row.get(18)?,
                media_count: row.get(19)?,
                account_created_at: row.get(20)?,
                last_online_time: row.get(21)?,
                latest_snapshot_at: row.get(22)?,
            })
        })?;

        rows.collect()
    }

    pub fn get_managed_accounts_for_task_selection(&self) -> Result<Vec<ManagedAccountForTask>> {
        let mut stmt = self.conn.prepare(
            "SELECT
                a.twitter_id,
                t.screen_name,
                t.display_name,
                t.avatar_url,
                a.personality_prompt
             FROM x_accounts a
             LEFT JOIN (
                 SELECT twitter_id, screen_name, display_name, avatar_url
                 FROM x_account_trend
                 WHERE (twitter_id, created_at) IN (
                     SELECT twitter_id, MAX(created_at)
                     FROM x_account_trend
                     GROUP BY twitter_id
                 )
             ) t ON a.twitter_id = t.twitter_id
             WHERE a.is_managed = 1
             ORDER BY a.managed_at DESC"
        )?;

        let accounts = stmt.query_map([], |row| {
            Ok(ManagedAccountForTask {
                twitter_id: row.get(0)?,
                screen_name: row.get(1)?,
                display_name: row.get(2)?,
                avatar_url: row.get(3)?,
                personality_prompt: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

        Ok(accounts)
    }

    pub fn get_task_ai_account_context(&self, twitter_id: &str) -> Result<Option<TaskAiAccountContext>> {
        let mut stmt = self.conn.prepare(
            "SELECT
                a.twitter_id,
                t.screen_name,
                t.display_name,
                t.description,
                t.is_verified,
                t.created_at AS latest_snapshot_at
             FROM x_accounts a
             LEFT JOIN (
                SELECT twitter_id, screen_name, display_name, description, is_verified, created_at,
                       ROW_NUMBER() OVER (PARTITION BY twitter_id ORDER BY created_at DESC, id DESC) AS rn
                FROM x_account_trend
             ) t ON a.twitter_id = t.twitter_id AND t.rn = 1
             WHERE a.twitter_id = ?1 AND a.is_managed = 1"
        )?;

        stmt.query_row(params![twitter_id], |row| {
            Ok(TaskAiAccountContext {
                twitter_id: row.get(0)?,
                screen_name: row.get(1)?,
                display_name: row.get(2)?,
                description: row.get(3)?,
                is_verified: row.get(4)?,
                latest_snapshot_at: row.get(5)?,
            })
        })
        .optional()
    }
}

#[cfg(test)]
mod tests {
    use super::TaskDatabase;
    use rusqlite::Connection;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn rejects_outdated_workspace_database_schema() {
        let temp_root = std::env::temp_dir().join(format!(
            "tweetpilot-task-db-tests-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&temp_root).expect("create temp dir");
        let db_path = temp_root.join("tweetpilot.db");

        let conn = Connection::open(&db_path).expect("open sqlite db");
        conn.execute_batch(
            "CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                script_path TEXT NOT NULL,
                script_content TEXT,
                script_hash TEXT,
                schedule TEXT,
                schedule_type TEXT DEFAULT 'cron',
                interval_seconds INTEGER,
                timeout INTEGER,
                retry_count INTEGER DEFAULT 0,
                retry_delay INTEGER DEFAULT 60,
                account_id TEXT NOT NULL,
                parameters TEXT,
                tweet_id TEXT,
                text TEXT,
                last_execution_status TEXT,
                last_execution_time TEXT,
                next_execution_time TEXT,
                total_executions INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                failure_count INTEGER DEFAULT 0,
                average_duration REAL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                tags TEXT
            );",
        )
        .expect("create legacy tasks table");
        drop(conn);

        let err = TaskDatabase::new(db_path).err().expect("legacy schema should be rejected");
        let message = format!("{err:?}");

        dbg!(&message);
        assert!(message.contains("no such column: execution_mode"));

        let _ = fs::remove_dir_all(&temp_root);
    }
}
