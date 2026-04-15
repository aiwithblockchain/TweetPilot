use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardLayout {
    pub id: String,
    pub card_type: CardType,
    pub position: u32,
    pub config: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardData {
    pub card_id: String,
    pub card_type: CardType,
    pub data: Value,
    pub last_updated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    AccountTweetStats,
    LatestTweets,
    AccountBasicData,
    AccountInteraction,
    TweetTimeDistribution,
    TaskExecutionStats,
}

#[tauri::command]
pub async fn get_layout() -> Result<Vec<CardLayout>, String> {
    // TODO: 获取卡片布局
    Ok(vec![])
}

#[tauri::command]
pub async fn save_layout(layout: Vec<CardLayout>) -> Result<(), String> {
    // TODO: 保存卡片布局
    Ok(())
}

#[tauri::command]
pub async fn add_card(card_type: CardType, config: Option<Value>) -> Result<String, String> {
    // TODO: 添加卡片
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn delete_card(card_id: String) -> Result<(), String> {
    // TODO: 删除卡片
    Ok(())
}

#[tauri::command]
pub async fn get_card_data(card_id: String) -> Result<CardData, String> {
    // TODO: 获取卡片数据
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn refresh_card_data(card_id: String) -> Result<CardData, String> {
    // TODO: 刷新卡片数据
    Err("Not implemented".to_string())
}
