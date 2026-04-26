use crate::services::storage;
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};

const WORKSPACE_CONFIG_FILE: &str = "config.json";
const RECENT_WORKSPACES_FILE: &str = "recent-workspaces.json";
const WORKSPACE_APP_DIR: &str = ".tweetpilot";
const WORKSPACE_MARKER_FILE: &str = ".tweetpilot.json";
const PRODUCT_FILE_NAME: &str = "product.md";
const CONTENT_RULES_FILE_NAME: &str = "content_rules.md";
const MAX_TEXT_FILE_BYTES: usize = 512 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
const SUPPORTED_TEXT_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "json", "md", "txt", "css", "scss", "html", "rs", "toml", "yml", "yaml",
    "xml", "sh", "env", "gitignore", "lock", "sql",
];

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct WorkspaceEntry {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub extension: Option<String>,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
    pub has_children: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct WorkspaceFileContent {
    pub path: String,
    pub name: String,
    pub extension: Option<String>,
    pub content_type: String,
    pub text_content: Option<String>,
    pub image_src: Option<String>,
    pub size: Option<u64>,
    pub modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct WorkspaceFolderSummary {
    pub path: String,
    pub name: String,
    pub item_count: usize,
    pub folder_count: usize,
    pub file_count: usize,
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

fn ensure_workspace_support_files(workspace_path: &Path) -> Result<(), String> {
    let config_dir = workspace_path.join(WORKSPACE_APP_DIR);
    std::fs::create_dir_all(&config_dir).map_err(|e| format!("创建工作目录配置目录失败: {}", e))?;

    let logs_dir = config_dir.join("logs");
    std::fs::create_dir_all(&logs_dir).map_err(|e| format!("创建日志目录失败: {}", e))?;

    let product_file = config_dir.join(PRODUCT_FILE_NAME);
    if !product_file.exists() {
        std::fs::write(&product_file, "").map_err(|e| format!("创建 product.md 失败: {}", e))?;
        log::info!("[workspace] Created missing workspace file: {}", product_file.display());
    }

    let content_rules_file = config_dir.join(CONTENT_RULES_FILE_NAME);
    if !content_rules_file.exists() {
        std::fs::write(&content_rules_file, "")
            .map_err(|e| format!("创建 content_rules.md 失败: {}", e))?;
        log::info!("[workspace] Created missing workspace file: {}", content_rules_file.display());
    }

    Ok(())
}

fn clear_current_workspace() -> Result<(), String> {
    let mut config = load_workspace_config()?;
    config.current_workspace = None;
    save_workspace_config(&config)
}

fn ensure_directory_path(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("目录不存在: {}", path.display()));
    }

    if !path.is_dir() {
        return Err(format!("不是目录: {}", path.display()));
    }

    Ok(())
}

fn extract_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_lowercase())
}

fn metadata_modified_at(metadata: &std::fs::Metadata) -> Option<String> {
    metadata
        .modified()
        .ok()
        .map(chrono::DateTime::<chrono::Utc>::from)
        .map(|time| time.to_rfc3339())
}

fn path_to_string(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(|value| value.to_string())
        .ok_or_else(|| format!("路径包含无效字符: {}", path.display()))
}

fn contains_children(path: &Path) -> bool {
    std::fs::read_dir(path)
        .ok()
        .and_then(|mut entries| entries.next())
        .is_some()
}

fn is_hidden_name(_name: &str) -> bool {
    // 显示所有文件,包括隐藏文件
    false
}

fn is_supported_image_extension(extension: Option<&str>) -> bool {
    extension
        .map(|value| SUPPORTED_IMAGE_EXTENSIONS.contains(&value))
        .unwrap_or(false)
}

fn is_supported_text_extension(extension: Option<&str>, file_name: &str) -> bool {
    if matches!(file_name, "Dockerfile" | "Makefile") {
        return true;
    }

    extension
        .map(|value| SUPPORTED_TEXT_EXTENSIONS.contains(&value))
        .unwrap_or(false)
}

fn is_likely_text_file(path: &Path) -> bool {
    let sample_size = 8192;

    match std::fs::read(path) {
        Ok(bytes) => {
            let check_bytes = if bytes.len() > sample_size {
                &bytes[..sample_size]
            } else {
                &bytes[..]
            };

            if check_bytes.is_empty() {
                return true;
            }

            let mut null_count = 0;
            let mut control_count = 0;
            let mut printable_count = 0;

            for &byte in check_bytes {
                match byte {
                    0 => null_count += 1,
                    1..=8 | 11..=12 | 14..=31 => control_count += 1,
                    9 | 10 | 13 | 32..=126 => printable_count += 1,
                    128..=255 => {
                        if is_valid_utf8_continuation(check_bytes, byte) {
                            printable_count += 1;
                        }
                    }
                    _ => {}
                }
            }

            if null_count > 0 {
                return false;
            }

            let total = check_bytes.len();
            let printable_ratio = printable_count as f64 / total as f64;
            let control_ratio = control_count as f64 / total as f64;

            printable_ratio > 0.85 && control_ratio < 0.10
        }
        Err(_) => false,
    }
}

fn is_valid_utf8_continuation(bytes: &[u8], _byte: u8) -> bool {
    std::str::from_utf8(bytes).is_ok()
}

fn map_workspace_entry(path: &Path, metadata: &std::fs::Metadata) -> Result<WorkspaceEntry, String> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| format!("无法读取文件名: {}", path.display()))?
        .to_string();

    let is_dir = metadata.is_dir();

    Ok(WorkspaceEntry {
        path: path_to_string(path)?,
        name,
        kind: if is_dir { "directory".to_string() } else { "file".to_string() },
        extension: if is_dir { None } else { extract_extension(path) },
        size: if metadata.is_file() { Some(metadata.len()) } else { None },
        modified_at: metadata_modified_at(metadata),
        has_children: if is_dir { contains_children(path) } else { false },
    })
}

fn validate_workspace_path(path: &Path) -> Result<(), String> {
    let config = load_workspace_config()?;
    let workspace_root = config
        .current_workspace
        .ok_or_else(|| "当前未选择工作目录".to_string())?;
    let workspace_root = PathBuf::from(workspace_root);
    let root = workspace_root
        .canonicalize()
        .map_err(|e| format!("解析工作目录失败: {}", e))?;
    let target = path
        .canonicalize()
        .map_err(|e| format!("解析目标路径失败: {}", e))?;

    if !target.starts_with(&root) {
        return Err("目标路径不在当前工作目录内".to_string());
    }

    Ok(())
}

fn validate_workspace_entry_name(name: &str, label: &str) -> Result<String, String> {
    let trimmed_name = name.trim();

    if trimmed_name.is_empty() {
        return Err(format!("{}不能为空", label));
    }

    if matches!(trimmed_name, "." | "..") {
        return Err(format!("{}不能为 . 或 ..", label));
    }

    if trimmed_name.contains('/') || trimmed_name.contains('\\') {
        return Err(format!("{}不能包含路径分隔符", label));
    }

    Ok(trimmed_name.to_string())
}

fn validate_workspace_target_path(path: &Path) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("目标路径无效: {}", path.display()))?;

    ensure_directory_path(parent)?;
    validate_workspace_path(parent)
}

fn map_workspace_entry_from_path(path: &Path) -> Result<WorkspaceEntry, String> {
    let metadata = std::fs::metadata(path).map_err(|e| format!("读取文件信息失败: {}", e))?;
    map_workspace_entry(path, &metadata)
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
pub async fn clone_from_github(
    repository_url: String,
    target_path: String,
    app: AppHandle,
) -> Result<String, String> {
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;

    let repo_url = repository_url.trim();
    let target_dir = Path::new(&target_path);

    if repo_url.is_empty() {
        return Err("仓库地址不能为空".to_string());
    }

    if !is_valid_github_url(repo_url) {
        return Err("无效的 GitHub URL，仅支持 https://github.com/ 或 git@github.com: 格式".to_string());
    }

    check_git_installed()?;

    let repo_name = extract_repo_name(repo_url);
    let final_target_dir = target_dir.join(&repo_name);

    if final_target_dir.exists() {
        return Err(format!(
            "目标目录已存在: {}，请先删除或选择其他位置",
            final_target_dir.display()
        ));
    }

    std::fs::create_dir_all(target_dir)
        .map_err(|e| format!("创建目录失败: {}", e))?;

    let mut child = Command::new("git")
        .arg("clone")
        .arg("--progress")
        .arg(repo_url)
        .arg(&final_target_dir)
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("执行 git clone 失败: {}", e))?;

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app.emit("clone-progress", &line);
            }
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("等待 git clone 完成失败: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_dir_all(&final_target_dir);

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

    let cloned_path = final_target_dir
        .to_str()
        .ok_or_else(|| "路径包含无效字符".to_string())?
        .to_string();

    update_recent_workspaces(&cloned_path)?;

    Ok(cloned_path)
}

#[tauri::command]
pub async fn get_recent_workspaces() -> Result<Vec<WorkspaceHistory>, String> {
    load_recent_workspaces()
}

#[tauri::command]
pub async fn set_current_workspace(
    path: String,
    app: AppHandle,
    task_state: tauri::State<'_, crate::task_commands::TaskState>,
    ai_state: tauri::State<'_, crate::commands::ai::AiState>,
) -> Result<(), String> {
    log::info!("[set_current_workspace] Starting workspace switch to: {}", path);

    if path.trim().is_empty() {
        return Err("工作目录不能为空".to_string());
    }

    let workspace_path = Path::new(&path);
    let marker_file = workspace_path.join(WORKSPACE_MARKER_FILE);

    if !marker_file.exists() {
        log::info!("[set_current_workspace] Marker file not found, initializing workspace");
        initialize_workspace(path.clone()).await?;
    } else {
        ensure_workspace_support_files(workspace_path)?;
    }

    // Step 1: Stop old workspace timers and release context (if exists)
    {
        let mut workspace_ctx = task_state.get_context().await;
        if let Some(old_ctx) = workspace_ctx.take() {
            log::info!("[set_current_workspace] Stopping old workspace timers");
            old_ctx.timer_manager.stop().await;
            log::info!("[set_current_workspace] Old workspace context released");
            drop(old_ctx);
        }
    }

    // Step 2: Cancel and clear active AI runtime state
    {
        let cancel_token = ai_state.cancel_token.lock().await.clone();
        if let Some(token) = cancel_token {
            log::info!("[set_current_workspace] Cancelling in-flight AI request before workspace switch");
            token.cancel();
        }

        *ai_state.session.lock().await = None;
        *ai_state.cancel_token.lock().await = None;
        *ai_state.active_request_id.lock().await = None;
        *ai_state.active_session_id.lock().await = None;
        *ai_state.active_working_dir.lock().await = None;
        log::info!("[set_current_workspace] Cleared active AI runtime state");
    }

    // Step 3: Create new workspace context
    log::info!("[set_current_workspace] Creating new workspace context");
    let new_ctx = crate::task_commands::WorkspaceContext::new(path.clone(), app.clone())?;

    // Step 4: Start timers for new workspace
    log::info!("[set_current_workspace] Starting timers for new workspace");
    new_ctx.start_timers().await?;

    // Step 5: Save new workspace context
    {
        let mut workspace_ctx = task_state.get_context().await;
        *workspace_ctx = Some(new_ctx);
    }

    // Step 6: Persist workspace config
    log::info!("[set_current_workspace] Persisting workspace config");
    persist_current_workspace(path)
}

#[tauri::command]
pub async fn check_workspace_initialized(path: String) -> Result<bool, String> {
    let workspace_path = Path::new(&path);
    let marker_file = workspace_path.join(WORKSPACE_MARKER_FILE);
    Ok(marker_file.exists())
}

#[tauri::command]
pub async fn initialize_workspace(path: String) -> Result<(), String> {
    let workspace_path = Path::new(&path);

    // Create .tweetpilot.json marker file
    let marker_file = workspace_path.join(WORKSPACE_MARKER_FILE);
    if !marker_file.exists() {
        std::fs::write(&marker_file, "{}").map_err(|e| e.to_string())?;
        log::info!("[workspace] Created workspace marker: {}", marker_file.display());
    }

    ensure_workspace_support_files(workspace_path)
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
pub async fn check_directory_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
pub async fn list_workspace_directory(path: String) -> Result<Vec<WorkspaceEntry>, String> {
    let directory = PathBuf::from(&path);
    ensure_directory_path(&directory)?;
    validate_workspace_path(&directory)?;

    let mut entries = Vec::new();

    for entry in std::fs::read_dir(&directory).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();

        if is_hidden_name(&file_name) {
            continue;
        }

        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|e| format!("读取文件信息失败: {}", e))?;
        entries.push(map_workspace_entry(&path, &metadata)?);
    }

    entries.sort_by(|left, right| match (left.kind.as_str(), right.kind.as_str()) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
pub async fn read_workspace_file(path: String) -> Result<WorkspaceFileContent, String> {
    let file_path = PathBuf::from(&path);
    validate_workspace_path(&file_path)?;

    let metadata = std::fs::metadata(&file_path).map_err(|e| format!("读取文件信息失败: {}", e))?;
    if !metadata.is_file() {
        return Err("目标不是文件".to_string());
    }

    let name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| format!("无法读取文件名: {}", file_path.display()))?
        .to_string();
    let extension = extract_extension(&file_path);
    let content_type = if is_supported_image_extension(extension.as_deref()) {
        "image"
    } else if is_supported_text_extension(extension.as_deref(), &name) {
        "text"
    } else if is_likely_text_file(&file_path) {
        "text"
    } else {
        "unsupported"
    };

    let text_content = if content_type == "text" {
        if metadata.len() as usize > MAX_TEXT_FILE_BYTES {
            Some("文件过大，v1 暂不预览超过 512KB 的文本文件。".to_string())
        } else {
            Some(std::fs::read_to_string(&file_path).map_err(|e| format!("读取文本文件失败: {}", e))?)
        }
    } else {
        None
    };

    let image_src = if content_type == "image" {
        let bytes = std::fs::read(&file_path).map_err(|e| format!("读取图片文件失败: {}", e))?;
        let mime = match extension.as_deref() {
            Some("png") => "image/png",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("gif") => "image/gif",
            Some("webp") => "image/webp",
            Some("bmp") => "image/bmp",
            Some("svg") => "image/svg+xml",
            _ => "application/octet-stream",
        };
        Some(format!("data:{};base64,{}", mime, BASE64_STANDARD.encode(bytes)))
    } else {
        None
    };

    Ok(WorkspaceFileContent {
        path,
        name,
        extension,
        content_type: content_type.to_string(),
        text_content,
        image_src,
        size: Some(metadata.len()),
        modified_at: metadata_modified_at(&metadata),
    })
}

#[tauri::command]
pub async fn get_workspace_folder_summary(path: String) -> Result<WorkspaceFolderSummary, String> {
    let directory = PathBuf::from(&path);
    ensure_directory_path(&directory)?;
    validate_workspace_path(&directory)?;

    let mut folder_count = 0usize;
    let mut file_count = 0usize;

    for entry in std::fs::read_dir(&directory).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();

        if is_hidden_name(&file_name) {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|e| format!("读取文件信息失败: {}", e))?;
        if metadata.is_dir() {
            folder_count += 1;
        } else {
            file_count += 1;
        }
    }

    let name = workspace_name(&path);

    Ok(WorkspaceFolderSummary {
        path,
        name,
        item_count: folder_count + file_count,
        folder_count,
        file_count,
    })
}

#[tauri::command]
pub async fn create_workspace_file(parent_path: String, name: String) -> Result<WorkspaceEntry, String> {
    let trimmed_name = validate_workspace_entry_name(&name, "文件名")?;

    let parent = PathBuf::from(&parent_path);
    ensure_directory_path(&parent)?;
    validate_workspace_path(&parent)?;

    let target = parent.join(trimmed_name);
    if target.exists() {
        return Err("同名文件已存在".to_string());
    }

    std::fs::write(&target, "").map_err(|e| format!("创建文件失败: {}", e))?;
    map_workspace_entry_from_path(&target)
}

#[tauri::command]
pub async fn create_workspace_folder(parent_path: String, name: String) -> Result<WorkspaceEntry, String> {
    let trimmed_name = validate_workspace_entry_name(&name, "文件夹名")?;

    let parent = PathBuf::from(&parent_path);
    ensure_directory_path(&parent)?;
    validate_workspace_path(&parent)?;

    let target = parent.join(trimmed_name);
    if target.exists() {
        return Err("同名文件夹已存在".to_string());
    }

    std::fs::create_dir_all(&target).map_err(|e| format!("创建文件夹失败: {}", e))?;
    map_workspace_entry_from_path(&target)
}

#[tauri::command]
pub async fn rename_workspace_entry(path: String, new_name: String) -> Result<WorkspaceEntry, String> {
    let trimmed_name = validate_workspace_entry_name(&new_name, "名称")?;
    let source = PathBuf::from(&path);
    validate_workspace_target_path(&source)?;

    if !source.exists() {
        return Err("要重命名的项目不存在".to_string());
    }

    let target = source
        .parent()
        .ok_or_else(|| format!("目标路径无效: {}", source.display()))?
        .join(trimmed_name);

    if target.exists() {
        return Err("当前目录下已存在同名项目".to_string());
    }

    std::fs::rename(&source, &target).map_err(|e| format!("重命名失败: {}", e))?;
    map_workspace_entry_from_path(&target)
}

#[tauri::command]
pub async fn delete_workspace_entry(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    validate_workspace_target_path(&target)?;

    if !target.exists() {
        return Err("要删除的项目不存在".to_string());
    }

    if target.is_dir() {
        std::fs::remove_dir_all(&target).map_err(|e| format!("删除文件夹失败: {}", e))?;
    } else {
        std::fs::remove_file(&target).map_err(|e| format!("删除文件失败: {}", e))?;
    }

    Ok(())
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

/// Open folder dialog and switch workspace in current window
pub async fn open_folder_dialog(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .set_title("Open Folder")
        .blocking_pick_folder();

    if let Some(folder_path) = path {
        let path_str = folder_path.to_string();

        // Get TaskState from app state
        let task_state = app.state::<crate::task_commands::TaskState>();
        let ai_state = app.state::<crate::commands::ai::AiState>();

        // Use set_current_workspace to properly update all state
        set_current_workspace(path_str.clone(), app.clone(), task_state, ai_state).await?;

        // Emit event to frontend to reload workspace
        app.emit("workspace-changed", path_str)
            .map_err(|e| format!("Failed to emit workspace-changed event: {}", e))?;
    }

    Ok(())
}

/// Open folder dialog and open in new window
pub async fn open_folder_in_new_window(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;
    use tauri::WebviewWindowBuilder;

    let path = app
        .dialog()
        .file()
        .set_title("Open Folder in New Window")
        .blocking_pick_folder();

    if let Some(folder_path) = path {
        let path_str = folder_path.to_string();

        // Create new window
        let window = WebviewWindowBuilder::new(
            &app,
            format!("workspace-{}", chrono::Utc::now().timestamp()),
            tauri::WebviewUrl::App("/".into()),
        )
        .title("TweetPilot")
        .inner_size(1280.0, 800.0)
        .decorations(false)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

        // Wait for window to be ready, then emit workspace path
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        window.emit("set-initial-workspace", path_str)
            .map_err(|e| format!("Failed to emit set-initial-workspace event: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{initialize_workspace, CONTENT_RULES_FILE_NAME, PRODUCT_FILE_NAME, WORKSPACE_APP_DIR, WORKSPACE_MARKER_FILE};
    use crate::services::test_home_guard::home_test_lock;
    use std::fs;
    use uuid::Uuid;

    fn with_test_dirs<T>(name: &str, test: impl FnOnce(std::path::PathBuf, std::path::PathBuf) -> T) -> T {
        let _guard = home_test_lock().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let temp_root = std::env::temp_dir().join(format!(
            "tweetpilot-workspace-tests-{}-{}",
            name,
            Uuid::new_v4()
        ));
        let home_dir = temp_root.join("home");
        let workspace_dir = temp_root.join("workspace");
        fs::create_dir_all(&home_dir).expect("create temp home");
        fs::create_dir_all(&workspace_dir).expect("create workspace dir");

        let previous_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", &home_dir);

        let result = test(home_dir, workspace_dir.clone());

        if let Some(home) = previous_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }

        let _ = fs::remove_dir_all(&temp_root);
        result
    }

    #[test]
    fn initialize_workspace_creates_support_files() {
        with_test_dirs("initialize-support-files", |_home_dir, workspace_dir| {
            tauri::async_runtime::block_on(async {
                initialize_workspace(workspace_dir.to_string_lossy().to_string())
                    .await
                    .expect("initialize workspace");
            });

            let marker_file = workspace_dir.join(WORKSPACE_MARKER_FILE);
            let config_dir = workspace_dir.join(WORKSPACE_APP_DIR);
            assert!(marker_file.exists());
            assert!(config_dir.join("logs").exists());
            assert!(config_dir.join(PRODUCT_FILE_NAME).exists());
            assert!(config_dir.join(CONTENT_RULES_FILE_NAME).exists());
        });
    }
}
