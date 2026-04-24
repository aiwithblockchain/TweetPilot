use crate::services::storage;
use crate::task_commands::TaskState;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;

const LAYOUT_FILE: &str = "data-blocks-layout.json";

fn default_cards() -> Vec<Card> {
    let now = chrono::Utc::now().to_rfc3339();

    vec![
        Card {
            id: "card_1".to_string(),
            card_type: "account_current_metrics".to_string(),
            position: 0,
            config: Some(json!({})),
            last_updated: now.clone(),
        },
        Card {
            id: "card_2".to_string(),
            card_type: "followers_growth_trend".to_string(),
            position: 1,
            config: Some(json!({"hours": 24})),
            last_updated: now.clone(),
        },
        Card {
            id: "card_3".to_string(),
            card_type: "account_activity_metrics".to_string(),
            position: 2,
            config: Some(json!({"hours": 24})),
            last_updated: now.clone(),
        },
        Card {
            id: "card_4".to_string(),
            card_type: "account_overview".to_string(),
            position: 3,
            config: Some(json!({"hours": 24})),
            last_updated: now,
        },
    ]
}

fn load_cards() -> Result<Vec<Card>, String> {
    storage::read_json(LAYOUT_FILE, default_cards())
}

fn save_cards(cards: &[Card]) -> Result<(), String> {
    storage::write_json(LAYOUT_FILE, &cards.to_vec())
}

fn get_card_or_error(cards: &[Card], card_id: &str) -> Result<Card, String> {
    cards.iter()
        .find(|card| card.id == card_id)
        .cloned()
        .ok_or_else(|| "积木不存在".to_string())
}

fn normalize_positions(cards: &mut [Card]) {
    for (index, card) in cards.iter_mut().enumerate() {
        card.position = index as u32;
    }
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    #[serde(rename = "type")]
    pub card_type: String,
    pub position: u32,
    pub config: Option<Value>,
    #[serde(rename = "lastUpdated")]
    pub last_updated: String,
}

#[tauri::command]
pub async fn get_layout() -> Result<Vec<Card>, String> {
    let mut cards = load_cards()?;
    cards.sort_by_key(|card| card.position);
    Ok(cards)
}

#[tauri::command]
pub async fn save_layout(layout: Vec<Card>) -> Result<(), String> {
    let mut ids = std::collections::HashSet::new();
    for card in &layout {
        if !ids.insert(card.id.clone()) {
            return Err("布局中存在重复积木".to_string());
        }
    }

    let mut next_layout = layout;
    normalize_positions(&mut next_layout);

    save_cards(&next_layout)
}

#[tauri::command]
pub async fn add_card(card_type: String, config: Option<Value>) -> Result<Card, String> {
    if card_type.trim().is_empty() {
        return Err("积木类型不能为空".to_string());
    }

    let mut cards = load_cards()?;
    if cards.iter().any(|card| card.card_type == card_type) {
        return Err("该积木类型已存在".to_string());
    }

    let next_card = Card {
        id: format!("card_{}", chrono::Utc::now().timestamp_millis()),
        card_type,
        position: cards.len() as u32,
        config: config.or_else(|| Some(json!({}))),
        last_updated: chrono::Utc::now().to_rfc3339(),
    };

    cards.push(next_card.clone());
    save_cards(&cards)?;
    Ok(next_card)
}

#[tauri::command]
pub async fn delete_card(card_id: String) -> Result<(), String> {
    let mut cards = load_cards()?;
    let original_len = cards.len();
    cards.retain(|card| card.id != card_id);
    if cards.len() == original_len {
        return Err("积木不存在".to_string());
    }
    normalize_positions(&mut cards);
    save_cards(&cards)
}

#[tauri::command]
pub async fn get_card_data(
    card_id: String,
    card_type: String,
    account_id: Option<String>,
    state: State<'_, TaskState>,
) -> Result<Value, String> {
    let cards = load_cards()?;
    let card = get_card_or_error(&cards, &card_id)?;
    if card.card_type != card_type {
        return Err("积木类型不匹配".to_string());
    }

    match card_type.as_str() {
        "account_current_metrics" => get_account_current_metrics(account_id, state).await,
        "followers_growth_trend" => get_followers_growth_trend(account_id, &card, state).await,
        "account_activity_metrics" => get_account_activity_metrics(account_id, &card, state).await,
        "account_overview" => get_account_overview(account_id, &card, state).await,
        _ => Ok(json!({})),
    }
}

#[tauri::command]
pub async fn get_data_block_preview(
    card_type: String,
    account_id: Option<String>,
    state: State<'_, TaskState>,
) -> Result<Value, String> {
    let card = Card {
        id: "preview".to_string(),
        card_type: card_type.clone(),
        position: 0,
        config: Some(match card_type.as_str() {
            "followers_growth_trend" | "account_activity_metrics" | "account_overview" => json!({"hours": 24}),
            _ => json!({}),
        }),
        last_updated: chrono::Utc::now().to_rfc3339(),
    };

    match card_type.as_str() {
        "account_current_metrics" => get_account_current_metrics(account_id, state).await,
        "followers_growth_trend" => get_followers_growth_trend(account_id, &card, state).await,
        "account_activity_metrics" => get_account_activity_metrics(account_id, &card, state).await,
        "account_overview" => get_account_overview(account_id, &card, state).await,
        _ => Ok(json!({})),
    }
}

#[tauri::command]
pub async fn refresh_card_data(card_id: String) -> Result<(), String> {
    tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

    let mut cards = load_cards()?;
    let card = cards
        .iter_mut()
        .find(|item| item.id == card_id)
        .ok_or_else(|| "积木不存在".to_string())?;
    card.last_updated = chrono::Utc::now().to_rfc3339();
    save_cards(&cards)
}

async fn get_account_current_metrics(account_id: Option<String>, state: State<'_, TaskState>) -> Result<Value, String> {
    let twitter_id = account_id.ok_or("缺少账号 ID")?;

    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let snapshot = ctx.db.lock().unwrap()
        .get_latest_account_snapshot(&twitter_id)
        .map_err(|e| format!("查询失败: {}", e))?
        .ok_or("未找到账号数据")?;

    Ok(json!({
        "screenName": snapshot.screen_name,
        "displayName": snapshot.display_name,
        "avatarUrl": snapshot.avatar_url,
        "isVerified": snapshot.is_verified,
        "followers": snapshot.followers_count,
        "following": snapshot.following_count,
        "tweets": snapshot.tweet_count,
        "favourites": snapshot.favourites_count,
        "listed": snapshot.listed_count,
        "media": snapshot.media_count,
        "snapshotTime": snapshot.created_at,
    }))
}

async fn get_followers_growth_trend(account_id: Option<String>, card: &Card, state: State<'_, TaskState>) -> Result<Value, String> {
    let twitter_id = account_id.ok_or("缺少账号 ID")?;

    let hours = card.config
        .as_ref()
        .and_then(|c| c.get("hours"))
        .and_then(|h| h.as_i64())
        .unwrap_or(24);

    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let snapshots = ctx.db.lock().unwrap()
        .get_account_snapshots(&twitter_id, Some(hours))
        .map_err(|e| format!("查询失败: {}", e))?;

    let data: Vec<Value> = snapshots.iter().rev().map(|s| {
        json!({
            "time": s.created_at,
            "followers": s.followers_count,
        })
    }).collect();

    let growth = if snapshots.len() >= 2 {
        let latest = snapshots.first().unwrap();
        let oldest = snapshots.last().unwrap();
        latest.followers_count.unwrap_or(0) - oldest.followers_count.unwrap_or(0)
    } else {
        0
    };

    Ok(json!({
        "data": data,
        "growth": growth,
        "hours": hours,
    }))
}

async fn get_account_activity_metrics(account_id: Option<String>, card: &Card, state: State<'_, TaskState>) -> Result<Value, String> {
    let twitter_id = account_id.ok_or("缺少账号 ID")?;

    let hours = card.config
        .as_ref()
        .and_then(|c| c.get("hours"))
        .and_then(|h| h.as_i64())
        .unwrap_or(24);

    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let snapshots = ctx.db.lock().unwrap()
        .get_account_snapshots(&twitter_id, Some(hours))
        .map_err(|e| format!("查询失败: {}", e))?;

    if snapshots.len() < 2 {
        return Ok(json!({
            "tweetChange": 0,
            "favouriteChange": 0,
            "mediaChange": 0,
            "hours": hours,
        }));
    }

    let latest = snapshots.first().unwrap();
    let oldest = snapshots.last().unwrap();

    Ok(json!({
        "tweetChange": latest.tweet_count.unwrap_or(0) - oldest.tweet_count.unwrap_or(0),
        "favouriteChange": latest.favourites_count.unwrap_or(0) - oldest.favourites_count.unwrap_or(0),
        "mediaChange": latest.media_count.unwrap_or(0) - oldest.media_count.unwrap_or(0),
        "hours": hours,
    }))
}

async fn get_account_overview(account_id: Option<String>, card: &Card, state: State<'_, TaskState>) -> Result<Value, String> {
    let twitter_id = account_id.ok_or("缺少账号 ID")?;

    let hours = card.config
        .as_ref()
        .and_then(|c| c.get("hours"))
        .and_then(|h| h.as_i64())
        .unwrap_or(24);

    let workspace_ctx = state.get_context().await;
    let ctx = workspace_ctx.as_ref()
        .ok_or("数据库未初始化，请先选择工作区")?;

    let snapshots = ctx.db.lock().unwrap()
        .get_account_snapshots(&twitter_id, Some(hours))
        .map_err(|e| format!("查询失败: {}", e))?;

    if snapshots.is_empty() {
        return Err("未找到账号数据".to_string());
    }

    let latest = snapshots.first().unwrap();

    let changes = if snapshots.len() >= 2 {
        let oldest = snapshots.last().unwrap();
        json!({
            "followers": latest.followers_count.unwrap_or(0) - oldest.followers_count.unwrap_or(0),
            "following": latest.following_count.unwrap_or(0) - oldest.following_count.unwrap_or(0),
            "tweets": latest.tweet_count.unwrap_or(0) - oldest.tweet_count.unwrap_or(0),
            "favourites": latest.favourites_count.unwrap_or(0) - oldest.favourites_count.unwrap_or(0),
        })
    } else {
        json!({
            "followers": 0,
            "following": 0,
            "tweets": 0,
            "favourites": 0,
        })
    };

    Ok(json!({
        "current": {
            "screenName": latest.screen_name,
            "displayName": latest.display_name,
            "avatarUrl": latest.avatar_url,
            "followers": latest.followers_count,
            "following": latest.following_count,
            "tweets": latest.tweet_count,
            "favourites": latest.favourites_count,
        },
        "changes": changes,
        "hours": hours,
    }))
}

