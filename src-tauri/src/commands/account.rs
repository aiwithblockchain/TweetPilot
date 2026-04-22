use crate::services::localbridge::LocalBridgeClient;

#[tauri::command]
pub async fn get_instances() -> Result<Vec<serde_json::Value>, String> {
    let config = crate::commands::preferences::get_local_bridge_config().await?;
    let client = LocalBridgeClient::new(config.endpoint, config.timeout_ms)?;
    client.get_instances().await
}
