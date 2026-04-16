use crate::services::storage;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;

const WORKSPACE_CONFIG_FILE: &str = "config.json";
const RECENT_WORKSPACES_FILE: &str = "recent-workspaces.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceHistory {
    pub path: String,
    pub name: String,
    pub last_accessed: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct WorkspaceConfig {
    current_workspace: Option<String>,
}

fn workspace_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path)
        .to_string()
}

fn load_workspace_config() -> Result<WorkspaceConfig, String> {
    storage::read_json(WORKSPACE_CONFIG_FILE, WorkspaceConfig::default())
}

fn save_workspace_config(config: &WorkspaceConfig) -> Result<(), String> {
    storage::write_json(WORKSPACE_CONFIG_FILE, config)
}

fn load_recent_workspaces() -> Result<Vec<WorkspaceHistory>, String> {
    storage::read_json(RECENT_WORKSPACES_FILE, Vec::<WorkspaceHistory>::new())
}

fn save_recent_workspaces(recent_workspaces: &[WorkspaceHistory]) -> Result<(), String> {
    storage::write_json(RECENT_WORKSPACES_FILE, &recent_workspaces)
}

fn update_recent_workspaces(path: &str) -> Result<(), String> {
    let mut recent_workspaces = load_recent_workspaces()?;
    recent_workspaces.retain(|item| item.path != path);
    recent_workspaces.insert(
        0,
        WorkspaceHistory {
            path: path.to_string(),
            name: workspace_name(path),
            last_accessed: chrono::Utc::now().to_rfc3339(),
        },
    );
    recent_workspaces.truncate(10);
    save_recent_workspaces(&recent_workspaces)
}

fn persist_current_workspace(path: String) -> Result<(), String> {
    let mut config = load_workspace_config()?;
    config.current_workspace = Some(path.clone());
    save_workspace_config(&config)?;
    update_recent_workspaces(&path)
}

fn clear_current_workspace() -> Result<(), String> {
    let mut config = load_workspace_config()?;
    config.current_workspace = None;
    save_workspace_config(&config)
}

#[tauri::command]
pub async fn select_local_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    println!("[workspace] select_local_directory called");

    let path = app
        .dialog()
        .file()
        .set_title("选择工作目录")
        .blocking_pick_folder();

    println!("[workspace] select_local_directory result: {:?}", path);

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
    persist_current_workspace(cloned_path.clone())?;

    Ok(cloned_path)
}

#[tauri::command]
pub async fn get_recent_workspaces() -> Result<Vec<WorkspaceHistory>, String> {
    load_recent_workspaces()
}

#[tauri::command]
pub async fn set_current_workspace(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("工作目录不能为空".to_string());
    }

    persist_current_workspace(path)
}

#[tauri::command]
pub async fn clear_current_workspace_command() -> Result<(), String> {
    clear_current_workspace()
}

#[tauri::command]
pub async fn get_current_workspace() -> Result<Option<String>, String> {
    let config = load_workspace_config()?;
    Ok(config.current_workspace)
}

#[tauri::command]
pub async fn open_workspace_in_new_window(app: AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    let _window = WebviewWindowBuilder::new(
        &app,
        format!("workspace-{}", chrono::Utc::now().timestamp()),
        tauri::WebviewUrl::App("/".into()),
    )
    .title("TweetPilot")
    .inner_size(1280.0, 800.0)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}
