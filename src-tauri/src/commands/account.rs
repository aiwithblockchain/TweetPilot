use crate::services::storage;
use crate::services::localbridge::LocalBridgeClient;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const ACCOUNTS_FILE: &str = "accounts.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedAccountData {
    mapped_accounts: Vec<TwitterAccount>,
    personalities: Vec<AccountPersonalityRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AccountPersonalityRecord {
    screen_name: String,
    personality: String,
}

fn default_persisted_accounts() -> PersistedAccountData {
    PersistedAccountData {
        mapped_accounts: vec![],
        personalities: vec![],
    }
}

fn load_persisted_accounts() -> Result<PersistedAccountData, String> {
    storage::read_json(ACCOUNTS_FILE, default_persisted_accounts())
}

fn save_persisted_accounts(data: &PersistedAccountData) -> Result<(), String> {
    storage::write_json(ACCOUNTS_FILE, data)
}

fn load_mapped_accounts() -> Result<Vec<TwitterAccount>, String> {
    Ok(load_persisted_accounts()?.mapped_accounts)
}

fn save_mapped_accounts(mapped_accounts: Vec<TwitterAccount>) -> Result<(), String> {
    let mut data = load_persisted_accounts()?;
    data.mapped_accounts = mapped_accounts;
    save_persisted_accounts(&data)
}

fn load_personality(screen_name: &str) -> Result<String, String> {
    let data = load_persisted_accounts()?;
    let personality = data
        .personalities
        .iter()
        .find(|item| item.screen_name == screen_name)
        .map(|item| item.personality.clone())
        .unwrap_or_default();
    Ok(personality)
}

fn save_personality(screen_name: &str, personality: String) -> Result<(), String> {
    let mut data = load_persisted_accounts()?;
    if let Some(entry) = data
        .personalities
        .iter_mut()
        .find(|item| item.screen_name == screen_name)
    {
        entry.personality = personality;
    } else {
        data.personalities.push(AccountPersonalityRecord {
            screen_name: screen_name.to_string(),
            personality,
        });
    }
    save_persisted_accounts(&data)
}

fn remove_personality(screen_name: &str) -> Result<(), String> {
    let mut data = load_persisted_accounts()?;
    data.personalities.retain(|item| item.screen_name != screen_name);
    save_persisted_accounts(&data)
}

fn with_mapped_accounts<R>(
    mut operation: impl FnMut(&mut Vec<TwitterAccount>) -> Result<R, String>,
) -> Result<R, String> {
    let mut in_memory_accounts = MAPPED_ACCOUNTS.lock().unwrap();
    let result = operation(&mut in_memory_accounts)?;
    save_mapped_accounts(in_memory_accounts.clone())?;
    Ok(result)
}

// Global storage for mapped accounts
static MAPPED_ACCOUNTS: Lazy<Mutex<Vec<TwitterAccount>>> = Lazy::new(|| {
    let initial = load_mapped_accounts()
        .unwrap_or_else(|_| default_persisted_accounts().mapped_accounts);
    Mutex::new(initial)
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

    with_mapped_accounts(|mapped| {
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
        };

        mapped.push(new_account.clone());
        Ok(new_account)
    })
}

#[tauri::command]
pub async fn delete_account_mapping(screen_name: String) -> Result<(), String> {
    with_mapped_accounts(|mapped| {
        mapped.retain(|a| a.screen_name != screen_name);
        Ok(())
    })
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
                with_mapped_accounts(|mapped| {
                    if let Some(account) = mapped.iter_mut().find(|a| a.screen_name == screen_name) {
                        account.status = if is_logged_in { AccountStatus::Online } else { AccountStatus::Offline };
                        account.is_logged_in = is_logged_in;
                        account.last_verified = chrono::Utc::now().to_rfc3339();
                        return Ok(account.status.clone());
                    }
                    Err("Account not found".to_string())
                })?;

                return Ok(if is_logged_in { AccountStatus::Online } else { AccountStatus::Offline });
            }
        }
    }

    // Fallback: return offline if cannot verify
    Ok(AccountStatus::Offline)
}

#[tauri::command]
pub async fn refresh_all_accounts_status() -> Result<(), String> {
    // Try to sync from LocalBridge
    let config = match crate::commands::preferences::get_local_bridge_config().await {
        Ok(c) => c,
        Err(_) => return Err("LocalBridge 配置未设置".to_string()),
    };

    let client = LocalBridgeClient::new(config.endpoint.clone(), config.timeout_ms)?;

    // Get all extension instances
    let instances = client.get_instances().await?;

    println!("=== 发现 {} 个实例 ===", instances.len());

    let mut synced_accounts = Vec::new();

    for instance in instances {
        let instance_id = instance.get("instanceId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Instance missing instanceId".to_string())?;

        let instance_name = instance.get("instanceName")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown");

        println!("处理实例: {} (ID: {})", instance_name, instance_id);

        // Try to get basic info for this instance
        match client.get_basic_info_with_instance(instance_id).await {
            Ok(basic_info) => {
                let screen_name = basic_info.screen_name
                    .as_ref()
                    .map(|sn| if sn.starts_with('@') { sn.clone() } else { format!("@{}", sn) })
                    .unwrap_or_else(|| format!("@{}", instance_name));

                let display_name = basic_info.name.clone().unwrap_or_else(|| instance_name.to_string());
                let avatar = basic_info.profile_image_url.clone()
                    .unwrap_or_else(|| "https://pbs.twimg.com/profile_images/default_profile_400x400.png".to_string());

                println!("  账号: {} ({})", display_name, screen_name);

                synced_accounts.push(TwitterAccount {
                    screen_name,
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
                });
            }
            Err(e) => {
                eprintln!("  获取实例 {} 的账号信息失败: {}", instance_name, e);
            }
        }
    }

    // Update mapped accounts with synced data
    with_mapped_accounts(|mapped| {
        let now = chrono::Utc::now().to_rfc3339();

        // Update existing accounts or add new ones
        for synced in &synced_accounts {
            if let Some(existing) = mapped.iter_mut().find(|a| a.screen_name == synced.screen_name) {
                existing.status = synced.status.clone();
                existing.last_verified = synced.last_verified.clone();
                existing.display_name = synced.display_name.clone();
                existing.avatar = synced.avatar.clone();
                existing.twitter_id = synced.twitter_id.clone();
                existing.description = synced.description.clone();
                existing.instance_id = synced.instance_id.clone();
                existing.extension_name = synced.extension_name.clone();
                existing.is_logged_in = synced.is_logged_in;
            } else {
                mapped.push(synced.clone());
            }
        }

        // Mark accounts not in LocalBridge as offline
        let synced_names: Vec<String> = synced_accounts.iter().map(|a| a.screen_name.clone()).collect();
        for account in mapped.iter_mut() {
            if !synced_names.contains(&account.screen_name) {
                account.status = AccountStatus::Offline;
                account.is_logged_in = false;
                account.last_verified = now.clone();
            }
        }

        Ok(())
    })
}

#[tauri::command]
pub async fn get_instances() -> Result<Vec<serde_json::Value>, String> {
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;
    client.get_instances().await
}

#[tauri::command]
pub async fn reconnect_account(screen_name: String) -> Result<(), String> {
    with_mapped_accounts(|mapped| {
        let account = mapped
            .iter_mut()
            .find(|a| a.screen_name == screen_name)
            .ok_or_else(|| format!("Account not found: {}", screen_name))?;

        account.status = AccountStatus::Online;
        account.last_verified = chrono::Utc::now().to_rfc3339();

        Ok(())
    })
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

    let personality = load_personality(&screen_name)?;

    Ok(AccountSettings {
        twitter_id: account.twitter_id.unwrap_or_else(|| "unknown".to_string()),
        name: account.display_name,
        screen_name: account.screen_name,
        avatar: account.avatar,
        is_linked: account.is_logged_in,
        extension_id: account.instance_id,
        extension_name: account.extension_name,
        personality,
    })
}

#[tauri::command]
pub async fn save_account_personality(screen_name: String, personality: String) -> Result<(), String> {
    save_personality(&screen_name, personality)
}

#[tauri::command]
pub async fn unlink_account(screen_name: String) -> Result<(), String> {
    with_mapped_accounts(|mapped| {
        mapped.retain(|a| a.screen_name != screen_name);
        Ok(())
    })?;
    Ok(())
}

#[tauri::command]
pub async fn delete_account_completely(screen_name: String) -> Result<(), String> {
    with_mapped_accounts(|mapped| {
        mapped.retain(|a| a.screen_name != screen_name);
        Ok(())
    })?;
    remove_personality(&screen_name)
}
