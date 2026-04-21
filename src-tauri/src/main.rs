// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod task_database;
mod task_executor;
mod task_commands;
mod task_module;
mod claurst_session;
mod unified_timer;

use commands::{workspace, account, data_blocks, preferences, ai};
use task_commands::TaskState;
use std::sync::Mutex;

async fn test_localbridge_connection() {
    use crate::services::storage;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct LocalBridgeConfig {
        endpoint: String,
        #[serde(rename = "timeoutMs")]
        timeout_ms: u64,
        #[serde(rename = "syncIntervalMs")]
        sync_interval_ms: u64,
    }

    fn default_config() -> LocalBridgeConfig {
        LocalBridgeConfig {
            endpoint: "http://127.0.0.1:10088".to_string(),
            timeout_ms: 30000,
            sync_interval_ms: 60000,
        }
    }

    let config: LocalBridgeConfig = storage::read_json("preferences.json", default_config())
        .unwrap_or_else(|_| default_config());

    let url = format!("{}/api/v1/x/instances", config.endpoint);

    println!("=== LocalBridge 连接测试 ===");
    println!("请求 URL: {}", url);
    println!("超时设置: {}ms", config.timeout_ms);

    match reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(config.timeout_ms))
        .build()
    {
        Ok(client) => {
            match client.get(&url).send().await {
                Ok(response) => {
                    println!("响应状态: {}", response.status());
                    println!("响应头: {:?}", response.headers());

                    match response.text().await {
                        Ok(body) => {
                            println!("响应内容长度: {} bytes", body.len());
                            println!("响应内容: {}", body);
                        }
                        Err(e) => {
                            eprintln!("读取响应内容失败: {}", e);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("请求失败: {}", e);
                    if e.is_connect() {
                        eprintln!("  原因: 无法连接到 LocalBridge");
                    } else if e.is_timeout() {
                        eprintln!("  原因: 请求超时");
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("创建 HTTP 客户端失败: {}", e);
        }
    }
    println!("=== 测试结束 ===\n");
}

fn main() {
    use std::sync::Arc;
    use unified_timer::{UnifiedTimerManager, Timer, TimerType, AccountSyncExecutor};

    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    log::info!("TweetPilot starting...");

    // Initialize task state (database will be initialized when workspace is selected)
    let task_executor = task_module::TaskExecutor::new();
    let db = Arc::new(Mutex::new(None));
    let workspace_root = Arc::new(Mutex::new(String::new()));

    // Initialize unified timer manager
    let timer_manager = Arc::new(UnifiedTimerManager::new());

    let task_state = TaskState {
        db: db.clone(),
        executor: Arc::new(task_executor),
        workspace_root: workspace_root.clone(),
        timer_manager: timer_manager.clone(),
    };

    // Initialize AI state
    let ai_state = ai::AiState {
        session: Arc::new(tokio::sync::Mutex::new(None)),
        cancel_token: Arc::new(tokio::sync::Mutex::new(None)),
        active_request_id: Arc::new(tokio::sync::Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(task_state)
        .manage(ai_state)
        .setup(move |app| {
            // Create native menu
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

                // File menu with custom items
                let open_item = MenuItemBuilder::with_id("open", "Open...")
                    .accelerator("CmdOrCtrl+O")
                    .build(app)?;

                let open_new_window_item = MenuItemBuilder::with_id("open_new_window", "Open in New Window...")
                    .accelerator("CmdOrCtrl+Shift+O")
                    .build(app)?;

                let file_menu = SubmenuBuilder::new(app, "File")
                    .item(&open_item)
                    .item(&open_new_window_item)
                    .separator()
                    .close_window()
                    .build()?;

                // Edit menu with standard items
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                // View menu
                let view_menu = SubmenuBuilder::new(app, "View")
                    .build()?;

                // Window menu
                let window_menu = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .maximize()
                    .build()?;

                // Help menu
                let help_menu = SubmenuBuilder::new(app, "Help")
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .item(&file_menu)
                    .item(&edit_menu)
                    .item(&view_menu)
                    .item(&window_menu)
                    .item(&help_menu)
                    .build()?;

                app.set_menu(menu)?;

                // Handle menu events
                app.on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "open" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(e) = workspace::open_folder_dialog(app_handle).await {
                                    eprintln!("Failed to open folder: {}", e);
                                }
                            });
                        }
                        "open_new_window" => {
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(e) = workspace::open_folder_in_new_window(app_handle).await {
                                    eprintln!("Failed to open folder in new window: {}", e);
                                }
                            });
                        }
                        _ => {}
                    }
                });
            }
            let timer_manager_clone = timer_manager.clone();

            tauri::async_runtime::spawn(async move {
                test_localbridge_connection().await;

                timer_manager_clone.register_executor(
                    "account_sync".to_string(),
                    Arc::new(AccountSyncExecutor)
                ).await;

                let account_sync_timer = Timer {
                    id: "system-account-sync".to_string(),
                    name: "账号状态同步".to_string(),
                    timer_type: TimerType::Interval { seconds: 60 },
                    enabled: true,
                    priority: 10,
                    next_execution: None,
                    last_execution: None,
                    executor: "account_sync".to_string(),
                    executor_config: serde_json::json!({}),
                };

                if let Err(e) = timer_manager_clone.register_timer(account_sync_timer).await {
                    eprintln!("Failed to register account sync timer: {}", e);
                }

                timer_manager_clone.start().await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            workspace::select_local_directory,
            workspace::clone_from_github,
            workspace::get_recent_workspaces,
            workspace::set_current_workspace,
            workspace::clear_current_workspace_command,
            workspace::get_current_workspace,
            workspace::open_workspace_in_new_window,
            workspace::check_directory_exists,
            workspace::check_workspace_initialized,
            workspace::initialize_workspace,
            workspace::list_workspace_directory,
            workspace::read_workspace_file,
            workspace::get_workspace_folder_summary,
            workspace::create_workspace_file,
            workspace::create_workspace_folder,
            // Account commands
            account::get_available_accounts,
            account::map_account,
            account::delete_account_mapping,
            account::get_mapped_accounts,
            account::get_instances,
            account::verify_account_status,
            account::refresh_all_accounts_status,
            account::reconnect_account,
            account::get_account_settings,
            account::save_account_personality,
            account::unlink_account,
            account::delete_account_completely,
            // Task commands (new implementation)
            task_module::create_task,
            task_module::get_tasks,
            task_module::get_task_detail,
            task_module::update_task,
            task_module::delete_task,
            task_module::pause_task,
            task_module::resume_task,
            task_module::execute_task,
            task_module::get_execution_history,
            task_module::get_timer_system_status,
            // Data blocks commands
            data_blocks::get_layout,
            data_blocks::save_layout,
            data_blocks::add_card,
            data_blocks::delete_card,
            data_blocks::get_card_data,
            data_blocks::refresh_card_data,
            // Preferences commands
            preferences::save_preferences,
            preferences::get_preferences,
            preferences::get_local_bridge_config,
            preferences::update_local_bridge_config,
            preferences::test_localbridge_connection,
            // AI commands
            ai::init_ai_session,
            ai::send_ai_message,
            ai::cancel_ai_message,
            ai::clear_ai_session,
            ai::get_ai_config,
            ai::save_ai_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
