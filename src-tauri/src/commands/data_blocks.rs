use crate::services::storage;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
    storage::write_json(LAYOUT_FILE, cards)
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
    _account_id: Option<String>,
) -> Result<Value, String> {
    let cards = load_cards()?;
    let card = get_card_or_error(&cards, &card_id)?;
    if card.card_type != card_type {
        return Err("卡片类型不匹配".to_string());
    }

    match card_type.as_str() {
        "latest_tweets" => Ok(json!({
            "tweets": [
                {
                    "time": "2小时前",
                    "text": "这是一条测试推文，展示最新推文列表功能。",
                    "likes": 42,
                    "retweets": 12
                },
                {
                    "time": "5小时前",
                    "text": "TweetPilot 开发进展顺利，UI 界面已经基本完成。",
                    "likes": 128,
                    "retweets": 34
                },
                {
                    "time": "1天前",
                    "text": "今天学习了 Tauri 框架，感觉非常强大！",
                    "likes": 89,
                    "retweets": 23
                }
            ]
        })),
        "account_basic_data" => Ok(json!({
            "following": 234,
            "followers": 1567,
            "tweets": 892,
            "likes": 3421
        })),
        "account_interaction_data" => Ok(json!({
            "totalViews": 45678,
            "totalLikes": 3421,
            "totalRetweets": 892
        })),
        "tweet_time_distribution" => Ok(json!({
            "data": [
                { "day": "周一", "count": 12 },
                { "day": "周二", "count": 8 },
                { "day": "周三", "count": 15 },
                { "day": "周四", "count": 10 },
                { "day": "周五", "count": 18 },
                { "day": "周六", "count": 5 },
                { "day": "周日", "count": 7 }
            ]
        })),
        "task_execution_stats" => Ok(json!({
            "data": [
                { "name": "成功", "value": 85 },
                { "name": "失败", "value": 15 }
            ]
        })),
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
