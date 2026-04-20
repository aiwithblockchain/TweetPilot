use crate::services::localbridge::LocalBridgeClient;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// Global in-memory storage for accounts (no persistence needed)
static MAPPED_ACCOUNTS: Lazy<Mutex<Vec<TwitterAccount>>> = Lazy::new(|| {
    Mutex::new(Vec::new())
});

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitterAccount {
    pub screen_name: String,
    pub display_name: String,
    pub avatar: String,
    pub status: AccountStatus,
    pub last_verified: String,
    pub twitter_id: Option<String>,
    pub description: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub default_tab_id: Option<i32>,
    #[serde(default = "default_is_logged_in")]
    pub is_logged_in: bool,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
}

fn default_is_logged_in() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitterAccountInfo {
    pub screen_name: String,
    pub display_name: String,
    pub avatar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccountStatus {
    Online,
    Offline,
    Verifying,
}

#[tauri::command]
pub async fn get_available_accounts() -> Result<Vec<TwitterAccountInfo>, String> {
    // Try to get accounts from LocalBridge
    if let Ok(config) = crate::commands::preferences::get_local_bridge_config().await {
        if let Ok(client) = LocalBridgeClient::new(config.endpoint, config.timeout_ms) {
            if let Ok(instances) = client.get_instances().await {
                let mapped = MAPPED_ACCOUNTS.lock().unwrap();
                let mapped_screen_names: Vec<String> =
                    mapped.iter().map(|a| a.screen_name.clone()).collect();

                let mut available = Vec::new();

                for instance in instances {
                    if let (Some(screen_name), Some(name)) = (
                        instance.get("screen_name").and_then(|v| v.as_str()),
                        instance.get("name").and_then(|v| v.as_str()),
                    ) {
                        let normalized_screen_name = if screen_name.starts_with('@') {
                            screen_name.to_string()
                        } else {
                            format!("@{}", screen_name)
                        };

                        // Only include if not already mapped
                        if !mapped_screen_names.contains(&normalized_screen_name) {
                            let avatar = instance
                                .get("profile_image_url")
                                .and_then(|v| v.as_str())
                                .unwrap_or("https://pbs.twimg.com/profile_images/default_profile_400x400.png")
                                .to_string();

                            available.push(TwitterAccountInfo {
                                screen_name: normalized_screen_name,
                                display_name: name.to_string(),
                                avatar,
                            });
                        }
                    }
                }

                return Ok(available);
            }
        }
    }

    // If LocalBridge is not available, return empty list
    Ok(vec![])
}

#[tauri::command]
pub async fn map_account(screen_name: String) -> Result<TwitterAccount, String> {
    // Get LocalBridge config and sync real account data
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;

    // Get instances to find the account
    let instances = client.get_instances().await?;

    let normalized_screen_name = if screen_name.starts_with('@') {
        screen_name.clone()
    } else {
        format!("@{}", screen_name)
    };

    // Find the instance matching this screen_name
    let instance = instances
        .iter()
        .find(|inst| {
            if let Some(sn) = inst.get("screen_name").and_then(|v| v.as_str()) {
                let inst_screen_name = if sn.starts_with('@') {
                    sn.to_string()
                } else {
                    format!("@{}", sn)
                };
                inst_screen_name == normalized_screen_name
            } else {
                false
            }
        })
        .ok_or_else(|| format!("Account {} not found in LocalBridge instances", screen_name))?;

    // Get basic info for this account
    let basic_info = client.get_basic_info().await.ok();
    let status = client.get_status().await.ok();

    // Extract instance metadata
    let instance_id = instance.get("id").and_then(|v| v.as_str()).map(String::from);
    let extension_name = instance.get("extensionName").and_then(|v| v.as_str()).map(String::from);

    let display_name = instance
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let avatar = instance
        .get("profile_image_url")
        .and_then(|v| v.as_str())
        .unwrap_or("https://pbs.twimg.com/profile_images/default_profile_400x400.png")
        .to_string();

    let twitter_id = basic_info.as_ref().and_then(|info| info.id.clone());
    let description = basic_info.as_ref().and_then(|info| info.description.clone());

    let is_logged_in = status.as_ref().map(|s| s.is_logged_in).unwrap_or(false);
    let default_tab_id = status.as_ref()
        .and_then(|s| s.tabs.first())
        .and_then(|t| t.tab_id);

    let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
    if mapped.iter().any(|item| item.screen_name == normalized_screen_name) {
        return Err(format!("Account {} already mapped", screen_name));
    }

    let new_account = TwitterAccount {
        screen_name: normalized_screen_name.clone(),
        display_name: display_name.clone(),
        avatar: avatar.clone(),
        status: if is_logged_in { AccountStatus::Online } else { AccountStatus::Offline },
        last_verified: chrono::Utc::now().to_rfc3339(),
        twitter_id: twitter_id.clone(),
        description: description.clone(),
        instance_id: instance_id.clone(),
        extension_name: extension_name.clone(),
        default_tab_id,
        is_logged_in,
        followers_count: basic_info.as_ref().and_then(|info| info.followers_count),
        following_count: basic_info.as_ref().and_then(|info| info.following_count),
        tweet_count: basic_info.as_ref().and_then(|info| info.tweet_count),
    };

    mapped.push(new_account.clone());
    Ok(new_account)
}

#[tauri::command]
pub async fn delete_account_mapping(screen_name: String) -> Result<(), String> {
    let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
    mapped.retain(|a| a.screen_name != screen_name);
    Ok(())
}

#[tauri::command]
pub async fn get_mapped_accounts() -> Result<Vec<TwitterAccount>, String> {
    let mapped = MAPPED_ACCOUNTS.lock().unwrap();
    Ok(mapped.clone())
}

#[tauri::command]
pub async fn verify_account_status(screen_name: String) -> Result<AccountStatus, String> {
    // Try to verify account status from LocalBridge
    if let Ok(config) = crate::commands::preferences::get_local_bridge_config().await {
        if let Ok(client) = LocalBridgeClient::new(config.endpoint, config.timeout_ms) {
            if let Ok(status) = client.get_status().await {
                // Check if this specific account is logged in
                let is_logged_in = status.is_logged_in;

                // Update the account status in memory
                let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
                if let Some(account) = mapped.iter_mut().find(|a| a.screen_name == screen_name) {
                    account.status = if is_logged_in { AccountStatus::Online } else { AccountStatus::Offline };
                    account.is_logged_in = is_logged_in;
                    account.last_verified = chrono::Utc::now().to_rfc3339();
                    return Ok(account.status.clone());
                }
                return Err("Account not found".to_string());
            }
        }
    }

    // Fallback: return offline if cannot verify
    Ok(AccountStatus::Offline)
}

#[tauri::command]
pub async fn refresh_all_accounts_status() -> Result<(), String> {
    let config = match crate::commands::preferences::get_local_bridge_config().await {
        Ok(c) => c,
        Err(_) => return Err("LocalBridge 配置未设置".to_string()),
    };

    let client = LocalBridgeClient::new(config.endpoint.clone(), config.timeout_ms)?;
    let instances = client.get_instances().await?;

    println!("=== 发现 {} 个实例 ===", instances.len());

    let existing_accounts = {
        let mapped = MAPPED_ACCOUNTS.lock().unwrap();
        mapped.clone()
    };

    let mut synced_accounts = Vec::new();

    for instance in instances.iter() {
        let instance_id = instance.get("instanceId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Instance missing instanceId".to_string())?;

        let instance_name = instance.get("instanceName")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown");

        let screen_name = instance.get("screen_name")
            .and_then(|v| v.as_str())
            .map(|sn| if sn.starts_with('@') { sn.to_string() } else { format!("@{}", sn) })
            .unwrap_or_else(|| format!("@{}", instance_name));

        let existing = existing_accounts.iter().find(|a| a.screen_name == screen_name);

        let should_fetch_details = if let Some(existing_account) = existing {
            let last_verified = chrono::DateTime::parse_from_rfc3339(&existing_account.last_verified)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .ok();

            if let Some(last_time) = last_verified {
                let now = chrono::Utc::now();
                let duration = now.signed_duration_since(last_time);
                duration.num_minutes() >= 5
            } else {
                true
            }
        } else {
            true
        };

        if should_fetch_details {
            println!("刷新账号详细信息: {} (ID: {})", instance_name, instance_id);
            match client.get_basic_info_with_instance(instance_id).await {
                Ok(basic_info) => {
                    let display_name = basic_info.name.clone().unwrap_or_else(|| instance_name.to_string());
                    let avatar = basic_info.profile_image_url.clone()
                        .unwrap_or_else(|| "https://pbs.twimg.com/profile_images/default_profile_400x400.png".to_string());

                    synced_accounts.push(TwitterAccount {
                        screen_name: screen_name.clone(),
                        display_name,
                        avatar,
                        status: AccountStatus::Online,
                        last_verified: chrono::Utc::now().to_rfc3339(),
                        twitter_id: basic_info.id.clone(),
                        description: basic_info.description.clone(),
                        instance_id: Some(instance_id.to_string()),
                        extension_name: Some(instance_name.to_string()),
                        default_tab_id: None,
                        is_logged_in: true,
                        followers_count: basic_info.followers_count,
                        following_count: basic_info.following_count,
                        tweet_count: basic_info.tweet_count,
                    });
                }
                Err(e) => {
                    eprintln!("  获取实例 {} 的账号信息失败: {}", instance_name, e);
                    if let Some(existing_account) = existing {
                        synced_accounts.push(existing_account.clone());
                    }
                }
            }
        } else {
            if let Some(existing_account) = existing {
                synced_accounts.push(existing_account.clone());
            }
        }
    }

    println!("=== 账号状态刷新成功 ===");
    println!("当前映射账号数量: {}", synced_accounts.len());

    {
        let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
        *mapped = synced_accounts;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_instances() -> Result<Vec<serde_json::Value>, String> {
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;
    client.get_instances().await
}

#[tauri::command]
pub async fn reconnect_account(screen_name: String) -> Result<(), String> {
    let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
    let account = mapped
        .iter_mut()
        .find(|a| a.screen_name == screen_name)
        .ok_or_else(|| format!("Account not found: {}", screen_name))?;

    account.status = AccountStatus::Online;
    account.last_verified = chrono::Utc::now().to_rfc3339();

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountSettings {
    pub twitter_id: String,
    pub name: String,
    pub screen_name: String,
    pub avatar: String,
    pub is_linked: bool,
    pub extension_id: Option<String>,
    pub extension_name: Option<String>,
    pub personality: String,
}

#[tauri::command]
pub async fn get_account_settings(screen_name: String) -> Result<AccountSettings, String> {
    let account = {
        let mapped = MAPPED_ACCOUNTS.lock().unwrap();
        mapped
            .iter()
            .find(|a| a.screen_name == screen_name)
            .cloned()
            .ok_or_else(|| "Account not found".to_string())?
    };

    Ok(AccountSettings {
        twitter_id: account.twitter_id.unwrap_or_else(|| "unknown".to_string()),
        name: account.display_name,
        screen_name: account.screen_name,
        avatar: account.avatar,
        is_linked: account.is_logged_in,
        extension_id: account.instance_id,
        extension_name: account.extension_name,
        personality: String::new(), // Personality feature removed
    })
}

#[tauri::command]
pub async fn save_account_personality(_screen_name: String, _personality: String) -> Result<(), String> {
    // Personality feature removed - no-op for backwards compatibility
    Ok(())
}

#[tauri::command]
pub async fn unlink_account(screen_name: String) -> Result<(), String> {
    let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
    mapped.retain(|a| a.screen_name != screen_name);
    Ok(())
}

#[tauri::command]
pub async fn delete_account_completely(screen_name: String) -> Result<(), String> {
    let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
    mapped.retain(|a| a.screen_name != screen_name);
    Ok(())
}
