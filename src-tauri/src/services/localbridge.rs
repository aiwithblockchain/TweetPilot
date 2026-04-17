use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct XStatus {
    #[serde(rename = "hasXTabs")]
    pub has_x_tabs: bool,
    #[serde(rename = "isLoggedIn")]
    pub is_logged_in: bool,
    pub tabs: Vec<XTab>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct XTab {
    #[serde(rename = "tabId")]
    pub tab_id: Option<i32>,
    pub title: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct XUser {
    pub id: Option<String>,
    pub name: Option<String>,
    pub screen_name: Option<String>,
    pub description: Option<String>,
}

pub struct LocalBridgeClient {
    base_url: String,
    client: Client,
}

impl LocalBridgeClient {
    pub fn new(base_url: String, timeout_ms: u64) -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_millis(timeout_ms))
            .build()
            .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

        Ok(Self { base_url, client })
    }

    pub async fn get_status(&self) -> Result<XStatus, String> {
        let url = format!("{}/api/v1/x/status", self.base_url);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() {
                    "无法连接到 LocalBridge，请确保 LocalBridge 正在运行".to_string()
                } else if e.is_timeout() {
                    "请求超时，LocalBridge 可能未响应".to_string()
                } else {
                    format!("请求失败: {}", e)
                }
            })?;

        if !response.status().is_success() {
            return Err(format!("API 返回错误: {}", response.status()));
        }

        response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    }

    pub async fn get_instances(&self) -> Result<Vec<serde_json::Value>, String> {
        let url = format!("{}/api/v1/x/instances", self.base_url);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() {
                    "无法连接到 LocalBridge".to_string()
                } else {
                    format!("请求失败: {}", e)
                }
            })?;

        if !response.status().is_success() {
            return Err(format!("API 返回错误: {}", response.status()));
        }

        response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    }

    pub async fn get_basic_info(&self) -> Result<XUser, String> {
        let url = format!("{}/api/v1/x/basic_info", self.base_url);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| {
                if e.is_connect() {
                    "无法连接到 LocalBridge".to_string()
                } else {
                    format!("请求失败: {}", e)
                }
            })?;

        if !response.status().is_success() {
            return Err(format!("API 返回错误: {}", response.status()));
        }

        let raw: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        let data = raw
            .get("data")
            .and_then(|d| d.get("data"))
            .unwrap_or(&raw);

        let user_result = data
            .get("viewer")
            .and_then(|v| v.get("user_results"))
            .and_then(|ur| ur.get("result"))
            .unwrap_or(data);

        let legacy = user_result
            .get("legacy")
            .unwrap_or(&serde_json::Value::Null);

        Ok(XUser {
            id: user_result
                .get("rest_id")
                .and_then(|v| v.as_str())
                .map(String::from),
            name: legacy
                .get("name")
                .and_then(|v| v.as_str())
                .map(String::from),
            screen_name: legacy
                .get("screen_name")
                .and_then(|v| v.as_str())
                .map(String::from),
            description: legacy
                .get("description")
                .and_then(|v| v.as_str())
                .map(String::from),
        })
    }

    pub async fn test_connection(&self) -> Result<(), String> {
        self.get_status().await?;
        Ok(())
    }
}
