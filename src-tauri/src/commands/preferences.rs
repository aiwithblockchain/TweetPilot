use crate::services::storage;
use serde::{Deserialize, Serialize};

const PREFERENCES_FILE: &str = "preferences.json";
const LOCAL_BRIDGE_CONFIG_FILE: &str = "local-bridge-config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preferences {
    pub language: String,
    pub theme: String,
    pub startup: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalBridgeConfig {
    pub endpoint: String,
    pub timeout_ms: u64,
    pub sync_interval_ms: u64,
}

fn default_preferences() -> Preferences {
    Preferences {
        language: "zh-CN".to_string(),
        theme: "dark".to_string(),
        startup: "last-workspace".to_string(),
    }
}

fn default_local_bridge_config() -> LocalBridgeConfig {
    LocalBridgeConfig {
        endpoint: "http://127.0.0.1:10088".to_string(),
        timeout_ms: 30000,
        sync_interval_ms: 60000,
    }
}

#[tauri::command]
pub async fn save_preferences(preferences: Preferences) -> Result<(), String> {
    storage::write_json(PREFERENCES_FILE, &preferences)
}

#[tauri::command]
pub async fn get_preferences() -> Result<Preferences, String> {
    storage::read_json(PREFERENCES_FILE, default_preferences())
}

#[tauri::command]
pub async fn get_local_bridge_config() -> Result<LocalBridgeConfig, String> {
    storage::read_json(LOCAL_BRIDGE_CONFIG_FILE, default_local_bridge_config())
}

#[tauri::command]
pub async fn update_local_bridge_config(config: LocalBridgeConfig) -> Result<(), String> {
    storage::write_json(LOCAL_BRIDGE_CONFIG_FILE, &config)
}

#[tauri::command]
pub async fn test_localbridge_connection() -> Result<bool, String> {
    use crate::services::localbridge::LocalBridgeClient;

    let config = storage::read_json(LOCAL_BRIDGE_CONFIG_FILE, default_local_bridge_config())?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;

    match client.test_connection().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
