use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredMessage {
    pub role: String,
    pub content: String,
    pub timestamp: i64,
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
}
