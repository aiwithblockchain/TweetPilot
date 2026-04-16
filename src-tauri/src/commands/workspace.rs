use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::{path::Path, sync::Mutex};
use tauri::AppHandle;

static CURRENT_WORKSPACE: Lazy<Mutex<Option<String>>> = Lazy::new(|| Mutex::new(None));
static RECENT_WORKSPACES: Lazy<Mutex<Vec<WorkspaceHistory>>> = Lazy::new(|| Mutex::new(Vec::new()));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceHistory {
    pub path: String,
    pub name: String,
    pub last_accessed: String,
}

fn workspace_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path)
        .to_string()
}

fn update_recent_workspaces(path: &str) {
    let mut recent = RECENT_WORKSPACES.lock().unwrap();
    recent.retain(|item| item.path != path);
    recent.insert(
        0,
        WorkspaceHistory {
            path: path.to_string(),
            name: workspace_name(path),
            last_accessed: chrono::Utc::now().to_rfc3339(),
        },
    );
    recent.truncate(10);
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
pub async fn clone_from_github(repository_url: String) -> Result<String, String> {
    let repo = repository_url.trim();
    if repo.is_empty() {
        return Err("仓库地址不能为空".to_string());
    }

    if !repo.starts_with("http://") && !repo.starts_with("https://") && !repo.starts_with("git@") {
        return Err("仓库地址格式非法".to_string());
    }

    let repo_name = repo
        .rsplit('/')
        .next()
        .unwrap_or("cloned-repo")
        .trim_end_matches(".git");

    let cloned_path = format!("/tmp/tweetpilot/{}", repo_name);

    let mut current_workspace = CURRENT_WORKSPACE.lock().unwrap();
    *current_workspace = Some(cloned_path.clone());
    drop(current_workspace);

    update_recent_workspaces(&cloned_path);

    Ok(cloned_path)
}

#[tauri::command]
pub async fn get_recent_workspaces() -> Result<Vec<WorkspaceHistory>, String> {
    let recent = RECENT_WORKSPACES.lock().unwrap();
    Ok(recent.clone())
}

#[tauri::command]
pub async fn set_current_workspace(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("工作目录不能为空".to_string());
    }

    let mut current_workspace = CURRENT_WORKSPACE.lock().unwrap();
    *current_workspace = Some(path.clone());
    drop(current_workspace);

    update_recent_workspaces(&path);

    Ok(())
}

#[tauri::command]
pub async fn get_current_workspace() -> Result<Option<String>, String> {
    let current_workspace = CURRENT_WORKSPACE.lock().unwrap();
    Ok(current_workspace.clone())
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
