use crate::services::localbridge::LocalBridgeClient;
use crate::task_commands::TaskState;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountListItemDto {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub is_managed: bool,
    pub is_online: bool,
    pub personality_prompt: Option<String>,
    pub latest_snapshot_at: Option<String>,
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountDetailAccountDto {
    pub twitter_id: String,
    pub is_managed: bool,
    pub managed_at: Option<String>,
    pub unmanaged_at: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub personality_prompt: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountLatestTrendDto {
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
    pub favourites_count: Option<i64>,
    pub listed_count: Option<i64>,
    pub media_count: Option<i64>,
    pub account_created_at: Option<String>,
    pub last_online_time: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountDetailDto {
    pub account: AccountDetailAccountDto,
    pub latest_trend: Option<AccountLatestTrendDto>,
}

#[tauri::command]
pub async fn get_instances() -> Result<Vec<serde_json::Value>, String> {
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;
    client.get_instances().await
}

#[tauri::command]
pub async fn get_managed_accounts(state: State<'_, TaskState>) -> Result<Vec<AccountListItemDto>, String> {
    log::info!("[get_managed_accounts] Loading managed accounts");
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let accounts = ctx.db.lock().unwrap()
        .get_managed_accounts_with_latest_snapshot()
        .map_err(|e| e.to_string())?;

    let result: Vec<AccountListItemDto> = accounts.into_iter().map(|account| AccountListItemDto {
        twitter_id: account.twitter_id,
        screen_name: account.screen_name.unwrap_or_default(),
        display_name: account.display_name.unwrap_or_default(),
        avatar_url: account.avatar_url,
        instance_id: account.instance_id,
        extension_name: account.extension_name,
        is_managed: account.is_managed,
        is_online: account.last_online_time.is_some(),
        personality_prompt: account.personality_prompt,
        latest_snapshot_at: account.latest_snapshot_at,
        source: "managed-db".to_string(),
    }).collect();

    log::info!("[get_managed_accounts] Returned {} managed accounts", result.len());
    Ok(result)
}

#[tauri::command]
pub async fn get_unmanaged_online_accounts(state: State<'_, TaskState>) -> Result<Vec<AccountListItemDto>, String> {
    log::info!("[get_unmanaged_online_accounts] Loading unmanaged-online accounts");
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let accounts = ctx.timer_manager
        .get_unmanaged_online_accounts()
        .await;

    let result: Vec<AccountListItemDto> = accounts.into_iter().map(|account| AccountListItemDto {
        twitter_id: account.twitter_id,
        screen_name: account.screen_name,
        display_name: account.display_name,
        avatar_url: account.avatar_url,
        instance_id: Some(account.instance_id),
        extension_name: Some(account.extension_name),
        is_managed: false,
        is_online: true,
        personality_prompt: None,
        latest_snapshot_at: Some(account.last_seen),
        source: "unmanaged-memory".to_string(),
    }).collect();

    let summary = result.iter()
        .map(|account| format!("{}(@{})", account.twitter_id, account.screen_name))
        .collect::<Vec<_>>()
        .join(", ");
    log::info!(
        "[get_unmanaged_online_accounts] Returned {} unmanaged-online accounts{}",
        result.len(),
        if summary.is_empty() { String::new() } else { format!(": {}", summary) }
    );
    Ok(result)
}

#[tauri::command]
pub async fn add_account_to_management(twitter_id: String, state: State<'_, TaskState>) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let maybe_unmanaged = ctx.timer_manager
        .get_unmanaged_online_account(&twitter_id)
        .await;

    let account = if let Some(account) = maybe_unmanaged {
        crate::models::twitter_account::TwitterBasicAccount {
            twitter_id: account.twitter_id,
            screen_name: account.screen_name,
            display_name: account.display_name,
            avatar_url: account.avatar_url,
            description: account.description,
            is_verified: account.is_verified,
            followers_count: account.followers_count,
            following_count: account.following_count,
            tweet_count: account.tweet_count,
            favourites_count: account.favourites_count,
            listed_count: account.listed_count,
            media_count: account.media_count,
            created_at: account.created_at,
            instance_id: account.instance_id,
            extension_name: account.extension_name,
            last_seen: chrono::DateTime::parse_from_rfc3339(&account.last_seen)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .unwrap_or_else(|_| chrono::Utc::now()),
        }
    } else if let Some(account_row) = ctx.db.lock().unwrap()
        .get_account_management_detail(&twitter_id)
        .map_err(|e| e.to_string())? {
        crate::models::twitter_account::TwitterBasicAccount {
            twitter_id: account_row.twitter_id,
            screen_name: String::new(),
            display_name: String::new(),
            avatar_url: None,
            description: None,
            is_verified: false,
            followers_count: None,
            following_count: None,
            tweet_count: None,
            favourites_count: None,
            listed_count: None,
            media_count: None,
            created_at: Some(account_row.created_at.clone()),
            instance_id: account_row.instance_id.unwrap_or_default(),
            extension_name: account_row.extension_name.unwrap_or_default(),
            last_seen: chrono::Utc::now(),
        }
    } else {
        return Err("账号不存在于未管理在线列表或历史管理记录中".to_string());
    };

    ctx.db.lock().unwrap()
        .add_account_to_management(&account)
        .map_err(|e| e.to_string())?;

    ctx.timer_manager
        .remove_unmanaged_online_account(&twitter_id)
        .await;

    Ok(())
}

#[tauri::command]
pub async fn remove_account_from_management(twitter_id: String, state: State<'_, TaskState>) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    ctx.db.lock().unwrap()
        .remove_account_from_management(&twitter_id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_account_personality_prompt(
    twitter_id: String,
    personality_prompt: Option<String>,
    state: State<'_, TaskState>,
) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    ctx.db.lock().unwrap()
        .update_account_personality_prompt(&twitter_id, personality_prompt.as_deref())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_account_completely(twitter_id: String, state: State<'_, TaskState>) -> Result<(), String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    ctx.db.lock().unwrap()
        .delete_account_completely(&twitter_id)
        .map_err(|e| e.to_string())?;
    ctx.timer_manager.remove_unmanaged_online_account(&twitter_id).await;
    Ok(())
}

#[tauri::command]
pub async fn get_account_detail(twitter_id: String, state: State<'_, TaskState>) -> Result<AccountDetailDto, String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    if let Some(account_row) = ctx.db.lock().unwrap()
        .get_account_management_detail(&twitter_id)
        .map_err(|e| e.to_string())? {
        let latest_trend = ctx.db.lock().unwrap()
            .get_latest_account_snapshot(&twitter_id)
            .map_err(|e| e.to_string())?
            .map(|trend| AccountLatestTrendDto {
                screen_name: trend.screen_name,
                display_name: trend.display_name,
                avatar_url: trend.avatar_url,
                description: trend.description,
                followers_count: trend.followers_count,
                following_count: trend.following_count,
                tweet_count: trend.tweet_count,
                favourites_count: trend.favourites_count,
                listed_count: trend.listed_count,
                media_count: trend.media_count,
                account_created_at: trend.account_created_at,
                last_online_time: trend.last_online_time,
                created_at: Some(trend.created_at),
            });

        return Ok(AccountDetailDto {
            account: AccountDetailAccountDto {
                twitter_id: account_row.twitter_id,
                is_managed: account_row.is_managed,
                managed_at: account_row.managed_at,
                unmanaged_at: account_row.unmanaged_at,
                instance_id: account_row.instance_id,
                extension_name: account_row.extension_name,
                personality_prompt: account_row.personality_prompt,
                created_at: Some(account_row.created_at),
                updated_at: Some(account_row.updated_at),
                source: "managed-db".to_string(),
            },
            latest_trend,
        });
    }

    if let Some(account) = ctx.timer_manager.get_unmanaged_online_account(&twitter_id).await {
        return Ok(AccountDetailDto {
            account: AccountDetailAccountDto {
                twitter_id: account.twitter_id.clone(),
                is_managed: false,
                managed_at: None,
                unmanaged_at: None,
                instance_id: Some(account.instance_id.clone()),
                extension_name: Some(account.extension_name.clone()),
                personality_prompt: None,
                created_at: None,
                updated_at: Some(account.last_seen.clone()),
                source: "unmanaged-memory".to_string(),
            },
            latest_trend: Some(AccountLatestTrendDto {
                screen_name: account.screen_name,
                display_name: account.display_name,
                avatar_url: account.avatar_url,
                description: account.description,
                followers_count: account.followers_count,
                following_count: account.following_count,
                tweet_count: account.tweet_count,
                favourites_count: account.favourites_count,
                listed_count: account.listed_count,
                media_count: account.media_count,
                account_created_at: account.created_at,
                last_online_time: Some(account.last_seen),
                created_at: None,
            }),
        });
    }

    Err("账号不存在".to_string())
}

#[tauri::command]
pub async fn get_account_trend(
    twitter_id: String,
    days: Option<i64>,
    state: State<'_, TaskState>,
) -> Result<Vec<crate::task_database::AccountTrendSnapshot>, String> {
    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let limit = days.map(|d| d.max(1) * 24);
    let snapshots = ctx.db.lock().unwrap()
        .get_account_snapshots(&twitter_id, limit)
        .map_err(|e| e.to_string())?;
    Ok(snapshots)
}
