use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwitterAccount {
    pub screen_name: String,
    pub display_name: String,
    pub avatar: String,
    pub status: AccountStatus,
    pub last_verified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    // TODO: 通过 LocalBridge 查询可映射的账号
    // Mock data for development
    Ok(vec![
        TwitterAccountInfo {
            screen_name: "@elonmusk".to_string(),
            display_name: "Elon Musk".to_string(),
            avatar: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg".to_string(),
        },
        TwitterAccountInfo {
            screen_name: "@jack".to_string(),
            display_name: "jack".to_string(),
            avatar: "https://pbs.twimg.com/profile_images/1115644092329758721/AFjOr-K8_400x400.jpg".to_string(),
        },
    ])
}

#[tauri::command]
pub async fn map_account(screen_name: String) -> Result<TwitterAccount, String> {
    // TODO: 建立账号映射
    // Mock implementation
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

    Ok(TwitterAccount {
        screen_name: screen_name.clone(),
        display_name: screen_name.trim_start_matches('@').to_string(),
        avatar: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg".to_string(),
        status: AccountStatus::Online,
        last_verified: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn delete_account_mapping(screen_name: String) -> Result<(), String> {
    // TODO: 删除账号映射
    println!("Deleting account mapping: {}", screen_name);
    Ok(())
}

#[tauri::command]
pub async fn get_mapped_accounts() -> Result<Vec<TwitterAccount>, String> {
    // TODO: 获取已映射的账号列表
    // Mock data for development
    Ok(vec![
        TwitterAccount {
            screen_name: "@testuser1".to_string(),
            display_name: "Test User 1".to_string(),
            avatar: "https://pbs.twimg.com/profile_images/1683325380441128960/yRsRRjGO_400x400.jpg".to_string(),
            status: AccountStatus::Online,
            last_verified: chrono::Utc::now().to_rfc3339(),
        },
    ])
}

#[tauri::command]
pub async fn verify_account_status(screen_name: String) -> Result<AccountStatus, String> {
    // TODO: 验证账号状态
    // Mock implementation with delay
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    println!("Verifying account status: {}", screen_name);
    Ok(AccountStatus::Online)
}

#[tauri::command]
pub async fn refresh_all_accounts_status() -> Result<(), String> {
    // TODO: 刷新所有账号状态
    Ok(())
}
