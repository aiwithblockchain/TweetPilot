use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preferences {
    pub language: String,
    pub theme: String,
    pub startup: String,
}

#[tauri::command]
pub async fn save_preferences(preferences: Preferences) -> Result<(), String> {
    // TODO: Save preferences to file
    println!("Saving preferences: {:?}", preferences);
    Ok(())
}

#[tauri::command]
pub async fn get_preferences() -> Result<Preferences, String> {
    // TODO: Load preferences from file
    // Mock implementation
    Ok(Preferences {
        language: "zh-CN".to_string(),
        theme: "dark".to_string(),
        startup: "last-workspace".to_string(),
    })
}
