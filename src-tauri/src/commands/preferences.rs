use crate::services::settings_store::{
    self, LocalBridgeConfig, Preferences,
};

#[tauri::command]
pub async fn save_preferences(preferences: Preferences) -> Result<(), String> {
    settings_store::save_preferences(&preferences)
}

#[tauri::command]
pub async fn get_preferences() -> Result<Preferences, String> {
    settings_store::get_preferences()
}

#[tauri::command]
pub async fn get_local_bridge_config() -> Result<LocalBridgeConfig, String> {
    settings_store::get_local_bridge_config()
}

#[tauri::command]
pub async fn update_local_bridge_config(config: LocalBridgeConfig) -> Result<(), String> {
    settings_store::update_local_bridge_config(&config)
}

#[tauri::command]
pub async fn test_localbridge_connection() -> Result<bool, String> {
    use crate::services::localbridge::LocalBridgeClient;

    let config = settings_store::get_local_bridge_config()?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;

    match client.test_connection().await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
