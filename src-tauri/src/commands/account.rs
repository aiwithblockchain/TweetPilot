use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Global storage for mapped accounts
static MAPPED_ACCOUNTS: Lazy<Mutex<Vec<TwitterAccount>>> = Lazy::new(|| {
    Mutex::new(vec![
        TwitterAccount {
            screen_name: "@testuser1".to_string(),
            display_name: "Test User 1".to_string(),
            avatar: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg".to_string(),
            status: AccountStatus::Online,
            last_verified: chrono::Utc::now().to_rfc3339(),
        },
    ])
});

// All available Twitter accounts (5 total)
const ALL_ACCOUNTS: &[(&str, &str, &str)] = &[
    ("@elonmusk", "Elon Musk", "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg"),
    ("@jack", "Jack Dorsey", "https://pbs.twimg.com/profile_images/1115644092329758721/AFjOr-K8_400x400.jpg"),
    ("@naval", "Naval", "https://pbs.twimg.com/profile_images/1469381207701483520/0ye3FdXq_400x400.jpg"),
    ("@pmarca", "Marc Andreessen", "https://pbs.twimg.com/profile_images/1455185376876826625/s1lXSWdX_400x400.jpg"),
    ("@sama", "Sam Altman", "https://pbs.twimg.com/profile_images/804990434455887872/BG0Xh7Oa_400x400.jpg"),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitterAccount {
    pub screen_name: String,
    pub display_name: String,
    pub avatar: String,
    pub status: AccountStatus,
    pub last_verified: String,
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
    // Get currently mapped accounts
    let mapped = MAPPED_ACCOUNTS.lock().unwrap();
    let mapped_screen_names: Vec<String> = mapped.iter().map(|a| a.screen_name.clone()).collect();
    drop(mapped);

    // Filter out already mapped accounts
    let available: Vec<TwitterAccountInfo> = ALL_ACCOUNTS
        .iter()
        .filter(|(screen_name, _, _)| !mapped_screen_names.contains(&screen_name.to_string()))
        .map(|(screen_name, display_name, avatar)| TwitterAccountInfo {
            screen_name: screen_name.to_string(),
            display_name: display_name.to_string(),
            avatar: avatar.to_string(),
        })
        .collect();

    Ok(available)
}

#[tauri::command]
pub async fn map_account(screen_name: String) -> Result<TwitterAccount, String> {
    // Simulate network delay
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

    println!("Mapping account: {}", screen_name);

    // Find account info from ALL_ACCOUNTS
    let account_info = ALL_ACCOUNTS
        .iter()
        .find(|(sn, _, _)| *sn == screen_name)
        .ok_or_else(|| format!("Account not found: {}", screen_name))?;

    let new_account = TwitterAccount {
        screen_name: account_info.0.to_string(),
        display_name: account_info.1.to_string(),
        avatar: account_info.2.to_string(),
        status: AccountStatus::Online,
        last_verified: chrono::Utc::now().to_rfc3339(),
    };

    // Add to mapped accounts
    let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
    mapped.push(new_account.clone());
    println!("Account mapped successfully. Total mapped: {}", mapped.len());

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
    // Simulate network delay
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    println!("Verifying account status: {}", screen_name);
    Ok(AccountStatus::Online)
}

#[tauri::command]
pub async fn refresh_all_accounts_status() -> Result<(), String> {
    // TODO: 刷新所有账号状态
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
    let mapped = MAPPED_ACCOUNTS.lock().unwrap();
    let account = mapped
        .iter()
        .find(|a| a.screen_name == screen_name)
        .ok_or_else(|| "Account not found".to_string())?;

    // Simulate fetching additional settings
    Ok(AccountSettings {
        twitter_id: format!("{}123456789", &screen_name[1..]), // Fake Twitter ID
        name: account.display_name.clone(),
        screen_name: account.screen_name.clone(),
        avatar: account.avatar.clone(),
        is_linked: true,
        extension_id: Some("ext_abc123".to_string()),
        extension_name: Some("LocalBridge Extension".to_string()),
        personality: String::new(), // TODO: Load from persistent storage
    })
}

#[tauri::command]
pub async fn save_account_personality(screen_name: String, personality: String) -> Result<(), String> {
    println!("Saving personality for {}: {}", screen_name, personality);
    // TODO: Save to persistent storage
    Ok(())
}

#[tauri::command]
pub async fn unlink_account(screen_name: String) -> Result<(), String> {
    let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
    mapped.retain(|a| a.screen_name != screen_name);
    println!("Unlinked account: {}", screen_name);
    Ok(())
}

#[tauri::command]
pub async fn delete_account_completely(screen_name: String) -> Result<(), String> {
    let mut mapped = MAPPED_ACCOUNTS.lock().unwrap();
    mapped.retain(|a| a.screen_name != screen_name);
    println!("Completely deleted account: {}", screen_name);
    // TODO: Delete local data blocks
    Ok(())
}
