use crate::services::storage;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
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

    let path = app
        .dialog()
        .file()
        .set_title("选择工作目录")
        .blocking_pick_folder();

    Ok(path.map(|p| p.to_string()))
}

fn is_valid_github_url(url: &str) -> bool {
    url.starts_with("https://github.com/") || url.starts_with("git@github.com:")
}

fn check_git_installed() -> Result<(), String> {
    let output = Command::new("git")
        .arg("--version")
        .output()
        .map_err(|_| "Git 未安装，请先安装 Git".to_string())?;

    if !output.status.success() {
        return Err("Git 未安装或无法运行".to_string());
    }

    Ok(())
}

fn extract_repo_name(url: &str) -> String {
    url.rsplit('/')
        .next()
        .unwrap_or("cloned-repo")
        .trim_end_matches(".git")
        .to_string()
}

#[tauri::command]
pub async fn clone_from_github(repository_url: String, target_path: String) -> Result<String, String> {
    let repo_url = repository_url.trim();
    let target_dir = Path::new(&target_path);

    // 1. 验证 URL 不为空
    if repo_url.is_empty() {
        return Err("仓库地址不能为空".to_string());
    }

    // 2. 验证是否为有效的 GitHub URL
    if !is_valid_github_url(repo_url) {
        return Err("无效的 GitHub URL，仅支持 https://github.com/ 或 git@github.com: 格式".to_string());
    }

    // 3. 检查 Git 是否安装
    check_git_installed()?;

    // 4. 提取仓库名称
    let repo_name = extract_repo_name(repo_url);

    // 5. 确定克隆目标目录
    let final_target_dir = target_dir.join(&repo_name);

    // 6. 检查目标目录是否已存在
    if final_target_dir.exists() {
        return Err(format!(
            "目标目录已存在: {}，请先删除或选择其他位置",
            final_target_dir.display()
        ));
    }

    // 7. 创建父目录
    std::fs::create_dir_all(target_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    // 8. 执行 git clone
    let output = Command::new("git")
        .arg("clone")
        .arg(repo_url)
        .arg(&final_target_dir)
        .output()
        .map_err(|e| format!("执行 git clone 失败: {}", e))?;

    // 9. 检查克隆是否成功
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);

        // 清理可能创建的空目录
        let _ = std::fs::remove_dir_all(&final_target_dir);

        // 提供更友好的错误信息
        if error_msg.contains("Repository not found") || error_msg.contains("not found") {
            return Err("仓库不存在或无权访问".to_string());
        } else if error_msg.contains("Authentication failed") {
            return Err("认证失败，请检查 Git 凭据配置".to_string());
        } else if error_msg.contains("Could not resolve host") {
            return Err("网络连接失败，请检查网络设置".to_string());
        } else {
            return Err(format!("克隆失败: {}", error_msg.trim()));
        }
    }

    // 10. 转换为字符串路径
    let cloned_path = final_target_dir
        .to_str()
        .ok_or_else(|| "路径包含无效字符".to_string())?
        .to_string();

    // 11. 更新最近使用的工作目录
    update_recent_workspaces(&cloned_path)?;

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
