use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToolCall {
    pub id: String,
    pub tool: String,
    pub action: String,
    #[serde(default)]
    pub input: Option<String>,
    #[serde(default)]
    pub output: Option<String>,
    pub status: String,
    #[serde(default)]
    pub duration: Option<f64>,
    pub start_time: i64,
    #[serde(default)]
    pub end_time: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    #[serde(default)]
    pub id: Option<String>,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
    #[serde(default)]
    pub thinking: Option<String>,
    #[serde(default)]
    pub thinking_complete: Option<bool>,
    #[serde(default)]
    pub tool_calls: Option<Vec<StoredToolCall>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: usize,
    #[serde(default)]
    pub workspace: String,
    #[serde(default)]
    pub schema_version: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadedSession {
    pub session: SessionMetadata,
    pub messages: Vec<StoredMessage>,
}

#[derive(Debug, Clone)]
pub struct CreateSessionInput {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub provider_id: Option<String>,
    pub model: String,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AiStorage {
    db_path: PathBuf,
    workspace: String,
}

impl AiStorage {
    pub fn new(working_dir: impl AsRef<Path>) -> Result<Self, String> {
        let working_dir = working_dir.as_ref();
        if !working_dir.exists() {
            return Err(format!("Directory does not exist: {}", working_dir.display()));
        }

        let db_path = working_dir.join(".tweetpilot").join("tweetpilot.db");
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create workspace database directory: {}", e))?;
        }

        Ok(Self {
            db_path,
            workspace: working_dir.to_string_lossy().to_string(),
        })
    }

    fn connection(&self) -> Result<Connection, String> {
        let conn = Connection::open(&self.db_path)
            .map_err(|e| format!("Failed to open AI workspace database: {}", e))?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;
        Ok(conn)
    }

    pub fn create_session(&self, input: CreateSessionInput) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO ai_sessions (id, title, created_at, updated_at, message_count, provider_id, model, system_prompt, schema_version)
             VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, 3)",
            params![
                input.id,
                input.title,
                input.created_at,
                input.updated_at,
                input.provider_id,
                input.model,
                input.system_prompt,
            ],
        )
        .map_err(|e| format!("Failed to create AI session: {}", e))?;
        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionMetadata>, String> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, created_at, updated_at, message_count, schema_version
                 FROM ai_sessions
                 ORDER BY updated_at DESC, created_at DESC",
            )
            .map_err(|e| format!("Failed to prepare AI session list query: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(SessionMetadata {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    message_count: row.get::<_, i64>(4)? as usize,
                    workspace: self.workspace.clone(),
                    schema_version: row.get(5)?,
                })
            })
            .map_err(|e| format!("Failed to query AI sessions: {}", e))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to load AI sessions: {}", e))
    }

    pub fn get_session_metadata(&self, session_id: &str) -> Result<SessionMetadata, String> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT id, title, created_at, updated_at, message_count, schema_version
             FROM ai_sessions
             WHERE id = ?1",
            params![session_id],
            |row| {
                Ok(SessionMetadata {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    message_count: row.get::<_, i64>(4)? as usize,
                    workspace: self.workspace.clone(),
                    schema_version: row.get(5)?,
                })
            },
        )
        .map_err(|e| format!("Failed to load AI session metadata: {}", e))
    }

    pub fn load_session(&self, session_id: &str) -> Result<LoadedSession, String> {
        let session = self.get_session_metadata(session_id)?;
        let messages = self.load_messages(session_id)?;
        Ok(LoadedSession { session, messages })
    }

    pub fn load_messages(&self, session_id: &str) -> Result<Vec<StoredMessage>, String> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, role, content, timestamp, thinking, thinking_complete, status
                 FROM ai_messages
                 WHERE session_id = ?1
                 ORDER BY timestamp ASC, id ASC",
            )
            .map_err(|e| format!("Failed to prepare AI message query: {}", e))?;

        let rows = stmt
            .query_map(params![session_id], |row| {
                let message_id: String = row.get(0)?;
                Ok(StoredMessage {
                    id: Some(message_id.clone()),
                    role: row.get(1)?,
                    content: row.get(2)?,
                    timestamp: row.get(3)?,
                    thinking: row.get(4)?,
                    thinking_complete: row.get(5)?,
                    tool_calls: None,
                    status: row.get(6)?,
                })
            })
            .map_err(|e| format!("Failed to query AI messages: {}", e))?;

        let mut messages = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to load AI messages: {}", e))?;

        for message in &mut messages {
            if let Some(message_id) = message.id.as_deref() {
                let tool_calls = self.load_tool_calls(message_id)?;
                if !tool_calls.is_empty() {
                    message.tool_calls = Some(tool_calls);
                }
            }
        }

        Ok(messages)
    }

    fn load_tool_calls(&self, message_id: &str) -> Result<Vec<StoredToolCall>, String> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, tool, action, input, output, status, duration, start_time, end_time
                 FROM ai_tool_calls
                 WHERE message_id = ?1
                 ORDER BY start_time ASC, id ASC",
            )
            .map_err(|e| format!("Failed to prepare AI tool-call query: {}", e))?;

        let rows = stmt
            .query_map(params![message_id], |row| {
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
            })
            .map_err(|e| format!("Failed to query AI tool calls: {}", e))?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to load AI tool calls: {}", e))
    }

    pub fn insert_message(&self, session_id: &str, message: &StoredMessage) -> Result<(), String> {
        let conn = self.connection()?;
        let message_id = message
            .id
            .clone()
            .ok_or_else(|| "AI message id is required for persistence".to_string())?;

        conn.execute(
            "INSERT INTO ai_messages (id, session_id, role, content, timestamp, thinking, thinking_complete, status)
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
        )
        .map_err(|e| format!("Failed to insert AI message: {}", e))?;

        self.refresh_session_metadata(session_id)
    }

    pub fn append_message_content(&self, message_id: &str, chunk: &str) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE ai_messages
             SET content = content || ?2
             WHERE id = ?1",
            params![message_id, chunk],
        )
        .map_err(|e| format!("Failed to append AI message content: {}", e))?;
        Ok(())
    }

    pub fn update_message_thinking(&self, message_id: &str, thinking: &str, thinking_complete: Option<bool>) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE ai_messages
             SET thinking = ?2, thinking_complete = COALESCE(?3, thinking_complete)
             WHERE id = ?1",
            params![message_id, thinking, thinking_complete],
        )
        .map_err(|e| format!("Failed to update AI thinking: {}", e))?;
        Ok(())
    }

    pub fn update_message_status(&self, message_id: &str, status: Option<&str>) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE ai_messages SET status = ?2 WHERE id = ?1",
            params![message_id, status],
        )
        .map_err(|e| format!("Failed to update AI message status: {}", e))?;
        Ok(())
    }

    pub fn finalize_message(&self, session_id: &str, message: &StoredMessage) -> Result<(), String> {
        let conn = self.connection()?;
        let message_id = message
            .id
            .clone()
            .ok_or_else(|| "AI message id is required for finalization".to_string())?;

        conn.execute(
            "UPDATE ai_messages
             SET content = ?2, thinking = ?3, thinking_complete = ?4, status = ?5, timestamp = ?6
             WHERE id = ?1",
            params![
                message_id,
                message.content,
                message.thinking,
                message.thinking_complete,
                message.status,
                message.timestamp,
            ],
        )
        .map_err(|e| format!("Failed to finalize AI message: {}", e))?;

        self.replace_tool_calls(&message_id, message.tool_calls.as_deref().unwrap_or(&[]))?;
        self.refresh_session_metadata(session_id)
    }

    pub fn replace_tool_calls(&self, message_id: &str, tool_calls: &[StoredToolCall]) -> Result<(), String> {
        let mut conn = self.connection()?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("Failed to start AI tool-call transaction: {}", e))?;

        tx.execute("DELETE FROM ai_tool_calls WHERE message_id = ?1", params![message_id])
            .map_err(|e| format!("Failed to delete AI tool calls: {}", e))?;

        for tool_call in tool_calls {
            tx.execute(
                "INSERT INTO ai_tool_calls (id, message_id, tool, action, input, output, status, duration, start_time, end_time)
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
            )
            .map_err(|e| format!("Failed to insert AI tool call: {}", e))?;
        }

        tx.commit()
            .map_err(|e| format!("Failed to commit AI tool-call transaction: {}", e))?;
        Ok(())
    }

    pub fn clear_session_messages(&self, session_id: &str) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute("DELETE FROM ai_messages WHERE session_id = ?1", params![session_id])
            .map_err(|e| format!("Failed to clear AI session messages: {}", e))?;
        self.refresh_session_metadata(session_id)
    }

    pub fn delete_session(&self, session_id: &str) -> Result<(), String> {
        let conn = self.connection()?;
        conn.execute("DELETE FROM ai_sessions WHERE id = ?1", params![session_id])
            .map_err(|e| format!("Failed to delete AI session: {}", e))?;
        Ok(())
    }

    pub fn get_session_runtime_config(&self, session_id: &str) -> Result<Option<(String, Option<String>, Option<String>)>, String> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT model, system_prompt, provider_id FROM ai_sessions WHERE id = ?1",
            params![session_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| format!("Failed to read AI runtime config: {}", e))
    }

    fn refresh_session_metadata(&self, session_id: &str) -> Result<(), String> {
        let conn = self.connection()?;
        let (message_count, updated_at) = conn
            .query_row(
                "SELECT COUNT(*), COALESCE(MAX(timestamp), created_at) FROM ai_messages
                 JOIN ai_sessions ON ai_sessions.id = ai_messages.session_id
                 WHERE session_id = ?1",
                params![session_id],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
            )
            .optional()
            .map_err(|e| format!("Failed to recalculate AI session metadata: {}", e))?
            .unwrap_or((0, 0));

        if message_count == 0 {
            let created_at = conn
                .query_row(
                    "SELECT created_at FROM ai_sessions WHERE id = ?1",
                    params![session_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()
                .map_err(|e| format!("Failed to read AI session creation time: {}", e))?
                .unwrap_or(0);

            conn.execute(
                "UPDATE ai_sessions SET message_count = 0, updated_at = created_at WHERE id = ?1",
                params![session_id],
            )
            .map_err(|e| format!("Failed to update empty AI session metadata: {}", e))?;

            if created_at == 0 {
                return Ok(());
            }

            return Ok(());
        }

        let title = conn
            .query_row(
                "SELECT content FROM ai_messages WHERE session_id = ?1 AND role = 'user' ORDER BY timestamp ASC, id ASC LIMIT 1",
                params![session_id],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| format!("Failed to derive AI session title: {}", e))?
            .map(|content| generate_title(&content))
            .unwrap_or_else(|| "新会话".to_string());

        conn.execute(
            "UPDATE ai_sessions
             SET title = ?2, message_count = ?3, updated_at = ?4
             WHERE id = ?1",
            params![session_id, title, message_count, updated_at],
        )
        .map_err(|e| format!("Failed to refresh AI session metadata: {}", e))?;

        Ok(())
    }
}

fn generate_title(first_message: &str) -> String {
    const MAX_LEN: usize = 50;
    let chars: Vec<char> = first_message.chars().collect();
    if chars.is_empty() {
        return "新会话".to_string();
    }
    if chars.len() <= MAX_LEN {
        first_message.to_string()
    } else {
        chars.iter().take(MAX_LEN).collect::<String>() + "..."
    }
}
