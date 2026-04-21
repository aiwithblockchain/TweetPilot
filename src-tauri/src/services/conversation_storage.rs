use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: usize,
    pub workspace: String,
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
