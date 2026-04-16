use crate::services::storage;
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
        mapped_accounts: vec![TwitterAccount {
            screen_name: "@testuser1".to_string(),
            display_name: "Test User 1".to_string(),
            avatar: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg"
                .to_string(),
            status: AccountStatus::Online,
            last_verified: chrono::Utc::now().to_rfc3339(),
        }],
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
    let mapped = MAPPED_ACCOUNTS.lock().unwrap();
    let mapped_screen_names: Vec<String> =
        mapped.iter().map(|a| a.screen_name.clone()).collect();

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
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

    let account_info = ALL_ACCOUNTS
        .iter()
        .find(|(sn, _, _)| *sn == screen_name)
        .ok_or_else(|| format!("Account not found: {}", screen_name))?;

    with_mapped_accounts(|mapped| {
        if mapped.iter().any(|item| item.screen_name == screen_name) {
            return Err(format!("Account already mapped: {}", screen_name));
        }

        let new_account = TwitterAccount {
            screen_name: account_info.0.to_string(),
            display_name: account_info.1.to_string(),
            avatar: account_info.2.to_string(),
            status: AccountStatus::Online,
            last_verified: chrono::Utc::now().to_rfc3339(),
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
    // Simulate network delay
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    println!("Verifying account status: {}", screen_name);
    Ok(AccountStatus::Online)
}

#[tauri::command]
pub async fn refresh_all_accounts_status() -> Result<(), String> {
    with_mapped_accounts(|mapped| {
        let now = chrono::Utc::now().to_rfc3339();
        for (index, account) in mapped.iter_mut().enumerate() {
            account.status = if index % 2 == 0 {
                AccountStatus::Online
            } else {
                AccountStatus::Offline
            };
            account.last_verified = now.clone();
        }
        Ok(())
    })
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
    let (name, resolved_screen_name, avatar) = {
        let mapped = MAPPED_ACCOUNTS.lock().unwrap();
        let account = mapped
            .iter()
            .find(|a| a.screen_name == screen_name)
            .ok_or_else(|| "Account not found".to_string())?;

        (
            account.display_name.clone(),
            account.screen_name.clone(),
            account.avatar.clone(),
        )
    };

    let personality = load_personality(&screen_name)?;

    Ok(AccountSettings {
        twitter_id: format!("{}123456789", &screen_name[1..]),
        name,
        screen_name: resolved_screen_name,
        avatar,
        is_linked: true,
        extension_id: Some("ext_abc123".to_string()),
        extension_name: Some("LocalBridge Extension".to_string()),
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
