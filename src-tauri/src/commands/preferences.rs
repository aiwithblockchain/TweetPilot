use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

static PREFERENCES: Lazy<Mutex<Preferences>> = Lazy::new(|| {
    Mutex::new(Preferences {
        language: "zh-CN".to_string(),
        theme: "dark".to_string(),
        startup: "last-workspace".to_string(),
    })
});

static LOCAL_BRIDGE_CONFIG: Lazy<Mutex<LocalBridgeConfig>> = Lazy::new(|| {
    Mutex::new(LocalBridgeConfig {
        endpoint: "http://127.0.0.1:9527".to_string(),
        api_key: String::new(),
        timeout_ms: 10000,
    })
});

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preferences {
    pub language: String,
    pub theme: String,
    pub startup: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalBridgeConfig {
    pub endpoint: String,
    pub api_key: String,
    pub timeout_ms: u32,
}

#[tauri::command]
pub async fn save_preferences(preferences: Preferences) -> Result<(), String> {
    let mut stored = PREFERENCES.lock().unwrap();
    *stored = preferences;
    Ok(())
}

#[tauri::command]
pub async fn get_preferences() -> Result<Preferences, String> {
    let stored = PREFERENCES.lock().unwrap();
    Ok(stored.clone())
}

#[tauri::command]
pub async fn get_local_bridge_config() -> Result<LocalBridgeConfig, String> {
    let config = LOCAL_BRIDGE_CONFIG.lock().unwrap();
    Ok(config.clone())
}

#[tauri::command]
pub async fn update_local_bridge_config(config: LocalBridgeConfig) -> Result<(), String> {
    let mut stored = LOCAL_BRIDGE_CONFIG.lock().unwrap();
    *stored = config;
    Ok(())
}
