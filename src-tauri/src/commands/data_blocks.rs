use crate::services::storage;
use crate::services::localbridge::LocalBridgeClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

const LAYOUT_FILE: &str = "data-blocks-layout.json";

fn default_cards() -> Vec<Card> {
    let now = chrono::Utc::now().to_rfc3339();

    vec![
        Card {
            id: "card_1".to_string(),
            card_type: "account_basic_data".to_string(),
            position: 0,
            config: Some(json!({})),
            last_updated: now.clone(),
        },
        Card {
            id: "card_2".to_string(),
            card_type: "latest_tweets".to_string(),
            position: 1,
            config: Some(json!({})),
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
        .ok_or_else(|| "卡片不存在".to_string())
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
            return Err("布局中存在重复卡片".to_string());
        }
    }

    let mut next_layout = layout;
    normalize_positions(&mut next_layout);

    save_cards(&next_layout)
}

#[tauri::command]
pub async fn add_card(card_type: String, config: Option<Value>) -> Result<Card, String> {
    if card_type.trim().is_empty() {
        return Err("卡片类型不能为空".to_string());
    }

    let mut cards = load_cards()?;
    if cards.iter().any(|card| card.card_type == card_type) {
        return Err("该卡片类型已存在".to_string());
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
        return Err("卡片不存在".to_string());
    }
    normalize_positions(&mut cards);
    save_cards(&cards)
}

#[tauri::command]
pub async fn get_card_data(
    card_id: String,
    card_type: String,
    account_id: Option<String>,
) -> Result<Value, String> {
    let cards = load_cards()?;
    let card = get_card_or_error(&cards, &card_id)?;
    if card.card_type != card_type {
        return Err("卡片类型不匹配".to_string());
    }

    // Get LocalBridge client if available
    let client = if let Ok(config) = crate::commands::preferences::get_local_bridge_config().await {
        LocalBridgeClient::new(config.endpoint, config.timeout_ms).ok()
    } else {
        None
    };

    match card_type.as_str() {
        "latest_tweets" => get_latest_tweets_data(client, account_id).await,
        "account_basic_data" => get_account_basic_data(client, account_id).await,
        "account_interaction_data" => get_account_interaction_data(client, account_id).await,
        "tweet_time_distribution" => get_tweet_time_distribution(client, account_id).await,
        "task_execution_stats" => get_task_execution_stats().await,
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
        .ok_or_else(|| "卡片不存在".to_string())?;
    card.last_updated = chrono::Utc::now().to_rfc3339();
    save_cards(&cards)
}

async fn get_latest_tweets_data(
    client: Option<LocalBridgeClient>,
    _account_id: Option<String>,
) -> Result<Value, String> {
    if let Some(client) = client {
        if let Ok(tweets) = client.get_timeline(None).await {
            let tweet_data: Vec<Value> = tweets
                .iter()
                .take(3)
                .map(|tweet| {
                    json!({
                        "time": format_tweet_time(&tweet.created_at),
                        "text": &tweet.text,
                        "likes": tweet.like_count.unwrap_or(0),
                        "retweets": tweet.retweet_count.unwrap_or(0)
                    })
                })
                .collect();

            return Ok(json!({ "tweets": tweet_data }));
        }
    }

    Ok(json!({ "tweets": [] }))
}

async fn get_account_basic_data(
    client: Option<LocalBridgeClient>,
    _account_id: Option<String>,
) -> Result<Value, String> {
    if let Some(client) = client {
        if let Ok(basic_info) = client.get_basic_info().await {
            return Ok(json!({
                "following": basic_info.following_count.unwrap_or(0),
                "followers": basic_info.followers_count.unwrap_or(0),
                "tweets": basic_info.tweet_count.unwrap_or(0),
                "likes": 0
            }));
        }
    }

    Ok(json!({
        "following": 0,
        "followers": 0,
        "tweets": 0,
        "likes": 0
    }))
}

async fn get_account_interaction_data(
    client: Option<LocalBridgeClient>,
    _account_id: Option<String>,
) -> Result<Value, String> {
    if let Some(client) = client {
        if let Ok(tweets) = client.get_timeline(None).await {
            let total_views: i64 = tweets.iter().filter_map(|t| t.view_count).sum();
            let total_likes: i64 = tweets.iter().filter_map(|t| t.like_count).sum();
            let total_retweets: i64 = tweets.iter().filter_map(|t| t.retweet_count).sum();

            return Ok(json!({
                "totalViews": total_views,
                "totalLikes": total_likes,
                "totalRetweets": total_retweets
            }));
        }
    }

    Ok(json!({
        "totalViews": 0,
        "totalLikes": 0,
        "totalRetweets": 0
    }))
}

async fn get_tweet_time_distribution(
    client: Option<LocalBridgeClient>,
    _account_id: Option<String>,
) -> Result<Value, String> {
    if let Some(client) = client {
        if let Ok(tweets) = client.get_timeline(None).await {
            let mut day_counts: HashMap<String, i32> = HashMap::new();
            day_counts.insert("周一".to_string(), 0);
            day_counts.insert("周二".to_string(), 0);
            day_counts.insert("周三".to_string(), 0);
            day_counts.insert("周四".to_string(), 0);
            day_counts.insert("周五".to_string(), 0);
            day_counts.insert("周六".to_string(), 0);
            day_counts.insert("周日".to_string(), 0);

            for tweet in tweets {
                if let Some(created_at) = &tweet.created_at {
                    if let Ok(day) = parse_day_of_week(created_at) {
                        *day_counts.entry(day).or_insert(0) += 1;
                    }
                }
            }

            let data: Vec<Value> = vec![
                json!({ "day": "周一", "count": day_counts.get("周一").unwrap_or(&0) }),
                json!({ "day": "周二", "count": day_counts.get("周二").unwrap_or(&0) }),
                json!({ "day": "周三", "count": day_counts.get("周三").unwrap_or(&0) }),
                json!({ "day": "周四", "count": day_counts.get("周四").unwrap_or(&0) }),
                json!({ "day": "周五", "count": day_counts.get("周五").unwrap_or(&0) }),
                json!({ "day": "周六", "count": day_counts.get("周六").unwrap_or(&0) }),
                json!({ "day": "周日", "count": day_counts.get("周日").unwrap_or(&0) }),
            ];

            return Ok(json!({ "data": data }));
        }
    }

    Ok(json!({
        "data": [
            { "day": "周一", "count": 0 },
            { "day": "周二", "count": 0 },
            { "day": "周三", "count": 0 },
            { "day": "周四", "count": 0 },
            { "day": "周五", "count": 0 },
            { "day": "周六", "count": 0 },
            { "day": "周日", "count": 0 }
        ]
    }))
}

async fn get_task_execution_stats() -> Result<Value, String> {
    // TODO: Implement with new task module
    // Temporarily return empty stats
    Ok(json!({
        "data": [
            { "name": "成功", "value": 0 },
            { "name": "失败", "value": 0 }
        ],
        "summary": {
            "total": 0,
            "success": 0,
            "failure": 0
        }
    }))
}

fn format_tweet_time(created_at: &Option<String>) -> String {
    if let Some(_time_str) = created_at {
        "最近".to_string()
    } else {
        "未知时间".to_string()
    }
}

fn parse_day_of_week(created_at: &str) -> Result<String, String> {
    let parts: Vec<&str> = created_at.split_whitespace().collect();
    if parts.is_empty() {
        return Err("Invalid date format".to_string());
    }

    let day_map = [
        ("Mon", "周一"),
        ("Tue", "周二"),
        ("Wed", "周三"),
        ("Thu", "周四"),
        ("Fri", "周五"),
        ("Sat", "周六"),
        ("Sun", "周日"),
    ];

    for (en, zh) in &day_map {
        if parts[0] == *en {
            return Ok(zh.to_string());
        }
    }

    Err("Unknown day".to_string())
}

