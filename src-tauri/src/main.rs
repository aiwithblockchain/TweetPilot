// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;

use commands::{workspace, account, task, data_blocks, preferences};

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

async fn start_account_sync_task() {
    use tokio::time::{interval, Duration};

    let mut tick_interval = interval(Duration::from_secs(60));

    loop {
        tick_interval.tick().await;

        match account::refresh_all_accounts_status().await {
            Ok(_) => {
                // Get and display current accounts status
                match account::get_mapped_accounts().await {
                    Ok(accounts) => {
                        println!("=== 账号状态刷新成功 ===");
                        println!("当前映射账号数量: {}", accounts.len());
                        for account in accounts {
                            println!("  - {} (@{}) | 状态: {:?} | 最后验证: {}",
                                account.display_name,
                                account.screen_name.trim_start_matches('@'),
                                account.status,
                                account.last_verified
                            );
                        }
                        println!("========================\n");
                    }
                    Err(e) => {
                        eprintln!("获取账号列表失败: {}", e);
                    }
                }
            }
            Err(e) => {
                eprintln!("账号状态刷新失败: {}", e);
            }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|_app| {
            tauri::async_runtime::spawn(async {
                test_localbridge_connection().await;
                start_account_sync_task().await;
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
            // Task commands
            task::create_task,
            task::get_tasks,
            task::get_task_detail,
            task::update_task,
            task::delete_task,
            task::pause_task,
            task::resume_task,
            task::execute_task,
            task::get_execution_history,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
