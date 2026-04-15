use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

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
    // TODO: 获取卡片布局
    // Mock data for development
    Ok(vec![
        Card {
            id: "card_1".to_string(),
            card_type: "account_basic_data".to_string(),
            position: 0,
            config: None,
            last_updated: chrono::Utc::now().to_rfc3339(),
        },
        Card {
            id: "card_2".to_string(),
            card_type: "latest_tweets".to_string(),
            position: 1,
            config: None,
            last_updated: chrono::Utc::now().to_rfc3339(),
        },
    ])
}

#[tauri::command]
pub async fn save_layout(_layout: Vec<Card>) -> Result<(), String> {
    // TODO: 保存卡片布局
    Ok(())
}

#[tauri::command]
pub async fn add_card(card_type: String, _config: Option<Value>) -> Result<Card, String> {
    // TODO: 添加卡片
    // Mock implementation
    let card_id = format!("card_{}", chrono::Utc::now().timestamp());

    Ok(Card {
        id: card_id,
        card_type,
        position: 0,
        config: None,
        last_updated: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn delete_card(_card_id: String) -> Result<(), String> {
    // TODO: 删除卡片
    println!("Deleting card: {}", _card_id);
    Ok(())
}

#[tauri::command]
pub async fn get_card_data(_card_id: String, card_type: String, _account_id: Option<String>) -> Result<Value, String> {
    // TODO: 获取卡片数据
    // Mock data based on card type
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
        _ => Ok(json!({}))
    }
}

#[tauri::command]
pub async fn refresh_card_data(_card_id: String) -> Result<(), String> {
    // TODO: 刷新卡片数据
    println!("Refreshing card data: {}", _card_id);
    Ok(())
}
