use crate::services::localbridge::LocalBridgeClient;
use serde::Serialize;
use std::collections::HashSet;

// New data structure for account with online status
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWithStatus {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub is_online: bool,
    pub last_online_time: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
}

#[tauri::command]
pub async fn refresh_all_accounts_status(
    state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String> {
    use crate::task_commands::AccountSyncMessage;

    log::info!("[refresh_all_accounts_status] Starting account sync");

    let config = crate::commands::preferences::get_local_bridge_config().await
        .map_err(|_| "LocalBridge 配置未设置".to_string())?;

    let client = LocalBridgeClient::new(config.endpoint.clone(), config.timeout_ms)?;
    let instances = client.get_instances().await?;

    log::info!("[refresh_all_accounts_status] Found {} instances", instances.len());

    for instance in instances.iter() {
        let instance_id = instance.get("instanceId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Instance missing instanceId".to_string())?;

        let instance_name = instance.get("instanceName")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown");

        log::debug!("[refresh_all_accounts_status] Processing instance: {} ({})", instance_name, instance_id);

        match client.get_basic_info_with_instance(instance_id).await {
            Ok(basic_info) => {
                let twitter_id = basic_info.id.unwrap_or_default();
                if twitter_id.is_empty() {
                    log::warn!("[refresh_all_accounts_status] Instance {} has no twitter_id, skipping", instance_name);
                    continue;
                }

                let screen_name = basic_info.screen_name
                    .map(|sn| if sn.starts_with('@') { sn } else { format!("@{}", sn) })
                    .unwrap_or_else(|| format!("@{}", instance_name));

                let message = AccountSyncMessage {
                    twitter_id,
                    screen_name,
                    display_name: basic_info.name.unwrap_or_else(|| instance_name.to_string()),
                    avatar_url: basic_info.profile_image_url,
                    is_verified: false,
                    description: basic_info.description,
                    instance_id: instance_id.to_string(),
                    extension_name: instance_name.to_string(),
                };

                // Send to Channel, don't wait for processing
                if let Err(e) = state.account_sync_tx.send(message).await {
                    log::error!("[refresh_all_accounts_status] Failed to send account to channel: {}", e);
                } else {
                    log::debug!("[refresh_all_accounts_status] Sent account {} to sync channel", instance_name);
                }
            }
            Err(e) => {
                log::warn!("[refresh_all_accounts_status] Failed to get account info for {}: {}", instance_name, e);
            }
        }
    }

    log::info!("[refresh_all_accounts_status] Account sync completed");
    Ok(())
}

#[tauri::command]
pub async fn get_instances() -> Result<Vec<serde_json::Value>, String> {
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;
    client.get_instances().await
}

// ==================== New Account Management Commands ====================

#[tauri::command]
pub async fn get_managed_accounts(
    state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<Vec<AccountWithStatus>, String> {
    log::info!("[get_managed_accounts] Fetching managed accounts");

    let managed = {
        let db = state.db.lock().unwrap();
        let database = db.as_ref().ok_or("Database not initialized")?;
        database.get_managed_accounts().map_err(|e| e.to_string())?
    };

    // Get online accounts from LocalBridge
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;
    let instances = client.get_instances().await.unwrap_or_default();

    let mut online_ids = HashSet::new();
    for instance in instances {
        if let Some(instance_id) = instance.get("instanceId").and_then(|v| v.as_str()) {
            if let Ok(info) = client.get_basic_info_with_instance(instance_id).await {
                if let Some(id) = info.id {
                    online_ids.insert(id);
                }
            }
        }
    }

    let result: Vec<AccountWithStatus> = managed
        .into_iter()
        .map(|acc| AccountWithStatus {
            is_online: online_ids.contains(&acc.twitter_id),
            twitter_id: acc.twitter_id,
            screen_name: acc.screen_name,
            display_name: acc.display_name,
            avatar_url: acc.avatar_url,
            description: acc.description,
            is_verified: acc.is_verified,
            last_online_time: acc.last_online_time,
            instance_id: acc.instance_id,
            extension_name: acc.extension_name,
        })
        .collect();

    log::info!("[get_managed_accounts] Returning {} managed accounts", result.len());
    Ok(result)
}

#[tauri::command]
pub async fn get_available_accounts(
    state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<Vec<AccountWithStatus>, String> {
    log::info!("[get_available_accounts] Fetching available accounts");

    let all_accounts = {
        let db = state.db.lock().unwrap();
        let database = db.as_ref().ok_or("Database not initialized")?;
        database.get_all_accounts().map_err(|e| e.to_string())?
    };

    // Get online accounts from LocalBridge
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;
    let instances = client.get_instances().await?;

    let mut available = Vec::new();
    for instance in instances {
        let instance_id = instance
            .get("instanceId")
            .and_then(|v| v.as_str())
            .ok_or("Missing instanceId")?;

        let instance_name = instance
            .get("instanceName")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown");

        if let Ok(info) = client.get_basic_info_with_instance(instance_id).await {
            if let Some(twitter_id) = info.id {
                // Check if not managed
                let is_managed = all_accounts
                    .iter()
                    .any(|acc| acc.twitter_id == twitter_id && acc.is_managed);

                if !is_managed {
                    available.push(AccountWithStatus {
                        twitter_id: twitter_id.clone(),
                        screen_name: info
                            .screen_name
                            .map(|sn| {
                                if sn.starts_with('@') {
                                    sn
                                } else {
                                    format!("@{}", sn)
                                }
                            })
                            .unwrap_or_else(|| format!("@{}", instance_name)),
                        display_name: info.name.unwrap_or_else(|| instance_name.to_string()),
                        avatar_url: info.profile_image_url,
                        description: info.description,
                        is_verified: false,
                        is_online: true,
                        last_online_time: None,
                        instance_id: Some(instance_id.to_string()),
                        extension_name: Some(instance_name.to_string()),
                    });
                }
            }
        }
    }

    log::info!("[get_available_accounts] Returning {} available accounts", available.len());
    Ok(available)
}

#[tauri::command]
pub async fn add_account_to_management(
    twitter_id: String,
    state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String> {
    log::info!("[add_account_to_management] Adding account {} to management", twitter_id);

    let db = state.db.lock().unwrap();
    let database = db.as_ref().ok_or("Database not initialized")?;
    database.set_account_managed(&twitter_id, true).map_err(|e| e.to_string())?;

    log::info!("[add_account_to_management] Account {} added to management", twitter_id);
    Ok(())
}

#[tauri::command]
pub async fn remove_account_from_management(
    twitter_id: String,
    state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String> {
    log::info!("[remove_account_from_management] Removing account {} from management", twitter_id);

    let db = state.db.lock().unwrap();
    let database = db.as_ref().ok_or("Database not initialized")?;
    database.set_account_managed(&twitter_id, false).map_err(|e| e.to_string())?;

    log::info!("[remove_account_from_management] Account {} removed from management", twitter_id);
    Ok(())
}

#[tauri::command]
pub async fn delete_account_completely(
    twitter_id: String,
    state: tauri::State<'_, crate::task_commands::TaskState>,
) -> Result<(), String> {
    log::info!("[delete_account_completely] Deleting account {} completely", twitter_id);

    let db = state.db.lock().unwrap();
    let database = db.as_ref().ok_or("Database not initialized")?;
    database.delete_account(&twitter_id).map_err(|e| e.to_string())?;

    // TODO: Delete associated data blocks

    log::info!("[delete_account_completely] Account {} deleted completely", twitter_id);
    Ok(())
}
