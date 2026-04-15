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
    Ok(vec![])
}

#[tauri::command]
pub async fn map_account(screen_name: String) -> Result<TwitterAccount, String> {
    // TODO: 建立账号映射
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn delete_account_mapping(screen_name: String) -> Result<(), String> {
    // TODO: 删除账号映射
    Ok(())
}

#[tauri::command]
pub async fn get_mapped_accounts() -> Result<Vec<TwitterAccount>, String> {
    // TODO: 获取已映射的账号列表
    Ok(vec![])
}

#[tauri::command]
pub async fn verify_account_status(screen_name: String) -> Result<AccountStatus, String> {
    // TODO: 验证账号状态
    Ok(AccountStatus::Offline)
}

#[tauri::command]
pub async fn refresh_all_accounts_status() -> Result<(), String> {
    // TODO: 刷新所有账号状态
    Ok(())
}
