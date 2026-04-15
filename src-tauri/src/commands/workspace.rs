use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceHistory {
    pub path: String,
    pub name: String,
    pub last_accessed: String,
}

#[tauri::command]
pub async fn select_local_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app.dialog()
        .file()
        .set_title("选择工作目录")
        .blocking_pick_folder();

    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn get_recent_workspaces() -> Result<Vec<WorkspaceHistory>, String> {
    // TODO: 读取 ~/.tweetpilot/recent-workspaces.json
    Ok(vec![])
}

#[tauri::command]
pub async fn set_current_workspace(path: String) -> Result<(), String> {
    // TODO: 写入 ~/.tweetpilot/config.json
    // TODO: 更新 recent-workspaces.json
    Ok(())
}

#[tauri::command]
pub async fn get_current_workspace() -> Result<Option<String>, String> {
    // TODO: 读取 ~/.tweetpilot/config.json
    Ok(None)
}

#[tauri::command]
pub async fn open_workspace_in_new_window(app: AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    // Create a new window
    let _window = WebviewWindowBuilder::new(
        &app,
        format!("workspace-{}", chrono::Utc::now().timestamp()),
        tauri::WebviewUrl::App("/".into())
    )
    .title("TweetPilot")
    .inner_size(1280.0, 800.0)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}
