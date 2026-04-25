use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

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

pub struct ConversationStorage {
    base_dir: PathBuf,
}

impl ConversationStorage {
    pub fn new() -> Result<Self, String> {
        let home = std::env::var("HOME").map_err(|_| "Cannot read HOME directory")?;
        let base_dir = PathBuf::from(home).join(".tweetpilot").join("conversations");
        fs::create_dir_all(&base_dir).map_err(|e| format!("Failed to create conversations directory: {}", e))?;
        Ok(Self { base_dir })
    }

    pub fn save_message(&self, session_id: &str, message: StoredMessage) -> Result<(), String> {
        let file_path = self.base_dir.join(format!("{}.jsonl", session_id));
        let line = serde_json::to_string(&message)
            .map_err(|e| format!("Failed to serialize message: {}", e))?;

        fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .and_then(|mut file| {
                use std::io::Write;
                writeln!(file, "{}", line)
            })
            .map_err(|e| format!("Failed to write message: {}", e))
    }

    pub fn load_messages(&self, session_id: &str) -> Result<Vec<StoredMessage>, String> {
        let file_path = self.base_dir.join(format!("{}.jsonl", session_id));

        if !file_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read messages: {}", e))?;

        content
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| {
                serde_json::from_str(line)
                    .map_err(|e| format!("Failed to parse message: {}", e))
            })
            .collect()
    }

    pub fn load_session(&self, session_id: &str) -> Result<LoadedSession, String> {
        let messages = self.load_messages(session_id)?;
        let session = self.get_session_metadata(session_id)?;

        Ok(LoadedSession { session, messages })
    }

    pub fn clear_messages(&self, session_id: &str) -> Result<(), String> {
        let file_path = self.base_dir.join(format!("{}.jsonl", session_id));
        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to clear messages: {}", e))?;
        }
        Ok(())
    }

    pub fn list_sessions(&self) -> Result<Vec<SessionMetadata>, String> {
        let mut sessions = Vec::new();

        let entries = fs::read_dir(&self.base_dir)
            .map_err(|e| format!("Failed to read conversations directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("jsonl") {
                if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Ok(metadata) = self.get_session_metadata(session_id) {
                        sessions.push(metadata);
                    }
                }
            }
        }

        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(sessions)
    }

    pub fn get_session_metadata(&self, session_id: &str) -> Result<SessionMetadata, String> {
        let messages = self.load_messages(session_id)?;

        if messages.is_empty() {
            return Ok(SessionMetadata {
                id: session_id.to_string(),
                title: "新会话".to_string(),
                created_at: 0,
                updated_at: 0,
                message_count: 0,
                workspace: String::new(),
                schema_version: Some(2),
            });
        }

        let first_message = &messages[0];
        let last_message = messages.last().unwrap();

        let title = self.generate_title(&first_message.content);
        let created_at = first_message.timestamp;
        let updated_at = last_message.timestamp;
        let message_count = messages.len();

        Ok(SessionMetadata {
            id: session_id.to_string(),
            title,
            created_at,
            updated_at,
            message_count,
            workspace: String::new(),
            schema_version: Some(2),
        })
    }

    pub fn delete_session(&self, session_id: &str) -> Result<(), String> {
        let file_path = self.base_dir.join(format!("{}.jsonl", session_id));
        if file_path.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to delete session: {}", e))?;
        }
        Ok(())
    }

    fn generate_title(&self, first_message: &str) -> String {
        const MAX_LEN: usize = 50;
        let chars: Vec<char> = first_message.chars().collect();
        if chars.len() <= MAX_LEN {
            first_message.to_string()
        } else {
            chars.iter().take(MAX_LEN).collect::<String>() + "..."
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{ConversationStorage, StoredMessage};
    use crate::services::test_home_guard::home_test_lock;
    use std::fs;
    use uuid::Uuid;

    fn with_test_home<T>(name: &str, test: impl FnOnce(ConversationStorage, String) -> T) -> T {
        let _guard = home_test_lock().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let temp_root = std::env::temp_dir().join(format!(
            "tweetpilot-conversation-storage-{}-{}",
            name,
            Uuid::new_v4()
        ));
        fs::create_dir_all(&temp_root).expect("create temp home");
        let previous_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", &temp_root);

        let storage = ConversationStorage::new().expect("create storage");
        let session_id = format!("session-{}", Uuid::new_v4());
        let result = test(storage, session_id.clone());

        if let Some(home) = previous_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }

        let _ = fs::remove_dir_all(&temp_root);
        result
    }

    #[test]
    fn load_session_returns_metadata_and_messages_without_active_session() {
        with_test_home("load-session", |storage, session_id| {
            storage
                .save_message(
                    &session_id,
                    StoredMessage {
                        id: None,
                        role: "user".to_string(),
                        content: "你好，帮我总结一下这个目录".to_string(),
                        timestamp: 1_710_000_000,
                        thinking: None,
                        thinking_complete: None,
                        tool_calls: None,
                        status: None,
                    },
                )
                .expect("save user message");

            storage
                .save_message(
                    &session_id,
                    StoredMessage {
                        id: None,
                        role: "assistant".to_string(),
                        content: "这是一个测试目录摘要".to_string(),
                        timestamp: 1_710_000_100,
                        thinking: None,
                        thinking_complete: None,
                        tool_calls: None,
                        status: None,
                    },
                )
                .expect("save assistant message");

            let loaded = storage.load_session(&session_id).expect("load session");

            assert_eq!(loaded.session.id, session_id);
            assert_eq!(loaded.session.message_count, 2);
            assert_eq!(loaded.session.created_at, 1_710_000_000);
            assert_eq!(loaded.session.updated_at, 1_710_000_100);
            assert_eq!(loaded.session.workspace, "");
            assert_eq!(loaded.messages.len(), 2);
            assert_eq!(loaded.messages[0].role, "user");
            assert_eq!(loaded.messages[1].role, "assistant");
        });
    }

    #[test]
    fn load_session_returns_empty_payload_for_missing_history() {
        with_test_home("missing-session", |storage, session_id| {
            let loaded = storage.load_session(&session_id).expect("load missing session");

            assert_eq!(loaded.session.id, session_id);
            assert_eq!(loaded.session.title, "新会话");
            assert_eq!(loaded.session.message_count, 0);
            assert!(loaded.messages.is_empty());
        });
    }
}
