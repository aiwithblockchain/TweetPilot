use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

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
    pub timeout: Option<i64>,
    pub retry_count: Option<i64>,
    pub retry_delay: Option<i64>,
    #[serde(rename = "accountScreenName")]
    pub account_id: String,
    pub parameters: String,
    pub last_execution_time: Option<String>,
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
        Ok(())
    }

    pub fn create_task(&self, input: TaskConfigInput) -> Result<Task> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let parameters = serde_json::to_string(&input.parameters.unwrap_or(serde_json::json!({})))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let tags = input.tags.map(|t| serde_json::to_string(&t).unwrap());

        self.conn.execute(
            "INSERT INTO tasks (
                id, name, description, type, status, enabled,
                script_path, schedule, timeout, retry_count, retry_delay,
                account_id, parameters, tags, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                id,
                input.name,
                input.description,
                input.task_type,
                "idle",
                true,
                input.script_path,
                input.schedule,
                input.timeout,
                input.retry_count,
                input.retry_delay,
                input.account_id,
                parameters,
                tags,
                now,
                now,
            ],
        )?;

        self.get_task(&id)
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
                timeout: row.get(10)?,
                retry_count: row.get(11)?,
                retry_delay: row.get(12)?,
                account_id: row.get(13)?,
                parameters: row.get(14)?,
                last_execution_time: row.get(15)?,
                next_execution_time: row.get(16)?,
                total_executions: row.get(17)?,
                success_count: row.get(18)?,
                failure_count: row.get(19)?,
                average_duration: row.get(20)?,
                created_at: row.get(21)?,
                updated_at: row.get(22)?,
                tags: row.get(23)?,
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
                timeout: row.get(10)?,
                retry_count: row.get(11)?,
                retry_delay: row.get(12)?,
                account_id: row.get(13)?,
                parameters: row.get(14)?,
                last_execution_time: row.get(15)?,
                next_execution_time: row.get(16)?,
                total_executions: row.get(17)?,
                success_count: row.get(18)?,
                failure_count: row.get(19)?,
                average_duration: row.get(20)?,
                created_at: row.get(21)?,
                updated_at: row.get(22)?,
                tags: row.get(23)?,
            })
        })?;

        tasks.collect()
    }

    pub fn update_task(&self, task_id: &str, input: TaskConfigInput) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        let parameters = serde_json::to_string(&input.parameters.unwrap_or(serde_json::json!({})))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let tags = input.tags.map(|t| serde_json::to_string(&t).unwrap());

        self.conn.execute(
            "UPDATE tasks SET
                name = ?1, description = ?2, script_path = ?3, schedule = ?4,
                timeout = ?5, retry_count = ?6, retry_delay = ?7, parameters = ?8,
                tags = ?9, updated_at = ?10
            WHERE id = ?11",
            params![
                input.name,
                input.description,
                input.script_path,
                input.schedule,
                input.timeout,
                input.retry_count,
                input.retry_delay,
                parameters,
                tags,
                now,
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
