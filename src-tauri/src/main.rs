// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;

use commands::{workspace, account, task, data_blocks, preferences};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            workspace::select_local_directory,
            workspace::get_recent_workspaces,
            workspace::set_current_workspace,
            workspace::get_current_workspace,
            workspace::open_workspace_in_new_window,
            // Account commands
            account::get_available_accounts,
            account::map_account,
            account::delete_account_mapping,
            account::get_mapped_accounts,
            account::verify_account_status,
            account::refresh_all_accounts_status,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
