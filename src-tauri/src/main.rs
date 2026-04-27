#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod app_events;
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

fn main() {
    // Initialize logger
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    log::info!("TweetPilot starting...");

    // Initialize task state (workspace context will be created when workspace is selected)
    let task_state = TaskState::new();
    let runtime_workspace_state = workspace::RuntimeWorkspaceState::new();

    // Initialize AI state
    let ai_state = ai::AiState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(task_state)
        .manage(runtime_workspace_state)
        .manage(ai_state)
        .setup(move |app| {
            if let Err(error) = services::resource_installer::ensure_bundled_home_installed(&app.path().resource_dir()?) {
                log::error!("Failed to install bundled TweetPilot home resources: {}", error);
            }

            // Create native menu
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

                // File menu with custom items
                let open_item = MenuItemBuilder::with_id("open", "Open...")
                    .accelerator("CmdOrCtrl+O")
                    .build(app)?;

                let file_menu = SubmenuBuilder::new(app, "File")
                    .item(&open_item)
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
                            let window = app
                                .webview_windows()
                                .into_values()
                                .find(|window| window.is_focused().unwrap_or(false));
                            tauri::async_runtime::spawn(async move {
                                if let Some(window) = window {
                                    if let Err(e) = workspace::open_folder_dialog(app_handle, window).await {
                                        eprintln!("Failed to open folder: {}", e);
                                    }
                                } else {
                                    eprintln!("Failed to open folder: no focused window found");
                                }
                            });
                        }
                        _ => {}
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            workspace::select_local_directory,
            workspace::clone_from_github,
            workspace::get_recent_workspaces,
            workspace::delete_recent_workspace,
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
            workspace::rename_workspace_entry,
            workspace::delete_workspace_entry,
            // Account commands
            account::get_instances,
            account::get_managed_accounts,
            account::get_unmanaged_online_accounts,
            account::add_account_to_management,
            account::remove_account_from_management,
            account::update_account_personality_prompt,
            account::delete_account_completely,
            account::get_account_detail,
            account::get_managed_accounts_for_task_selection,
            account::get_account_trend,
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
            data_blocks::get_data_block_preview,
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
            ai::list_ai_sessions,
            ai::get_session_metadata,
            ai::load_ai_session,
            ai::activate_ai_session,
            ai::delete_ai_session,
            ai::create_new_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
