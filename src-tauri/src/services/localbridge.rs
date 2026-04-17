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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XUser {
    pub id: Option<String>,
    pub name: Option<String>,
    pub screen_name: Option<String>,
    pub description: Option<String>,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
    pub profile_image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XTweet {
    pub id: String,
    pub text: String,
    pub created_at: Option<String>,
    pub author: Option<XUser>,
    pub like_count: Option<i64>,
    pub retweet_count: Option<i64>,
    pub reply_count: Option<i64>,
    pub view_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct XSearchResult {
    pub tweets: Vec<XTweet>,
    pub cursor: Option<String>,
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

        self.parse_user_from_response(&raw)
    }

    pub async fn get_basic_info_with_instance(&self, instance_id: &str) -> Result<XUser, String> {
        let url = format!("{}/api/v1/x/basic_info", self.base_url);
        let response = self
            .client
            .get(&url)
            .header("X-Instance-ID", instance_id)
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
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API 返回错误 {}: {}", status, body));
        }

        let raw: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        self.parse_user_from_response(&raw)
    }

    fn parse_user_from_response(&self, raw: &serde_json::Value) -> Result<XUser, String> {

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
            followers_count: legacy.get("followers_count").and_then(|v| v.as_i64()),
            following_count: legacy.get("friends_count").and_then(|v| v.as_i64()),
            tweet_count: legacy.get("statuses_count").and_then(|v| v.as_i64()),
            profile_image_url: legacy.get("profile_image_url_https").and_then(|v| v.as_str()).map(String::from),
        })
    }

    pub async fn test_connection(&self) -> Result<(), String> {
        self.get_status().await?;
        Ok(())
    }

    pub async fn get_timeline(&self, tab_id: Option<i32>) -> Result<Vec<XTweet>, String> {
        let mut url = format!("{}/api/v1/x/timeline", self.base_url);
        if let Some(tid) = tab_id {
            url = format!("{}?tabId={}", url, tid);
        }

        let response = self.client.get(&url).send().await.map_err(|e| {
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

        self.parse_tweets_from_timeline(&raw)
    }

    pub async fn get_user(
        &self,
        screen_name: &str,
        tab_id: Option<i32>,
    ) -> Result<XUser, String> {
        let mut url = format!("{}/api/v1/x/users?screenName={}", self.base_url, screen_name);
        if let Some(tid) = tab_id {
            url = format!("{}&tabId={}", url, tid);
        }

        let response = self.client.get(&url).send().await.map_err(|e| {
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

        self.parse_user_from_response(&raw)
    }

    pub async fn get_tweet(
        &self,
        tweet_id: &str,
        tab_id: Option<i32>,
    ) -> Result<XTweet, String> {
        let mut url = format!("{}/api/v1/x/tweets/{}", self.base_url, tweet_id);
        if let Some(tid) = tab_id {
            url = format!("{}?tabId={}", url, tid);
        }

        let response = self.client.get(&url).send().await.map_err(|e| {
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

        self.parse_tweet_from_response(&raw)
    }

    pub async fn get_tweet_replies(
        &self,
        tweet_id: &str,
        cursor: Option<&str>,
        tab_id: Option<i32>,
    ) -> Result<(Vec<XTweet>, Option<String>), String> {
        let mut url = format!("{}/api/v1/x/tweets/{}/replies", self.base_url, tweet_id);
        let mut params = vec![];
        if let Some(c) = cursor {
            params.push(format!("cursor={}", c));
        }
        if let Some(tid) = tab_id {
            params.push(format!("tabId={}", tid));
        }
        if !params.is_empty() {
            url = format!("{}?{}", url, params.join("&"));
        }

        let response = self.client.get(&url).send().await.map_err(|e| {
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

        let tweets = self.parse_tweets_from_timeline(&raw)?;
        let next_cursor = raw
            .get("cursor")
            .and_then(|v| v.as_str())
            .map(String::from);

        Ok((tweets, next_cursor))
    }

    pub async fn search(
        &self,
        query: &str,
        count: Option<i32>,
        cursor: Option<&str>,
        tab_id: Option<i32>,
    ) -> Result<XSearchResult, String> {
        let mut url = format!("{}/api/v1/x/search?q={}", self.base_url,
            urlencoding::encode(query));

        if let Some(c) = count {
            url = format!("{}&count={}", url, c);
        }
        if let Some(cur) = cursor {
            url = format!("{}&cursor={}", url, cur);
        }
        if let Some(tid) = tab_id {
            url = format!("{}&tabId={}", url, tid);
        }

        let response = self.client.get(&url).send().await.map_err(|e| {
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

        let tweets = self.parse_tweets_from_timeline(&raw)?;
        let next_cursor = raw
            .get("cursor")
            .and_then(|v| v.as_str())
            .map(String::from);

        Ok(XSearchResult {
            tweets,
            cursor: next_cursor,
        })
    }

    pub async fn get_pinned_tweet(
        &self,
        screen_name: &str,
        tab_id: Option<i32>,
    ) -> Result<Option<XTweet>, String> {
        let mut url = format!("{}/api/v1/x/users?screenName={}", self.base_url, screen_name);
        if let Some(tid) = tab_id {
            url = format!("{}&tabId={}", url, tid);
        }

        let response = self.client.get(&url).send().await.map_err(|e| {
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

        let pinned_tweet_id = raw
            .get("data")
            .and_then(|d| d.get("user"))
            .and_then(|u| u.get("result"))
            .and_then(|r| r.get("legacy"))
            .and_then(|l| l.get("pinned_tweet_ids_str"))
            .and_then(|p| p.as_array())
            .and_then(|arr| arr.first())
            .and_then(|v| v.as_str());

        if let Some(tweet_id) = pinned_tweet_id {
            let tweet = self.get_tweet(tweet_id, tab_id).await?;
            Ok(Some(tweet))
        } else {
            Ok(None)
        }
    }

    pub async fn create_tweet(
        &self,
        text: &str,
        media_ids: Option<Vec<String>>,
    ) -> Result<(), String> {
        let url = format!("{}/api/v1/x/tweets", self.base_url);
        let body = serde_json::json!({
            "text": text,
            "mediaIds": media_ids.unwrap_or_default(),
        });

        let response = self.client.post(&url).json(&body).send().await.map_err(|e| {
            if e.is_connect() {
                "无法连接到 LocalBridge".to_string()
            } else {
                format!("请求失败: {}", e)
            }
        })?;

        if !response.status().is_success() {
            return Err(format!("API 返回错误: {}", response.status()));
        }

        Ok(())
    }

    pub async fn reply(
        &self,
        tweet_id: &str,
        text: &str,
        media_ids: Option<Vec<String>>,
    ) -> Result<(), String> {
        let url = format!("{}/api/v1/x/replies", self.base_url);
        let body = serde_json::json!({
            "tweetId": tweet_id,
            "text": text,
            "mediaIds": media_ids.unwrap_or_default(),
        });

        let response = self.client.post(&url).json(&body).send().await.map_err(|e| {
            if e.is_connect() {
                "无法连接到 LocalBridge".to_string()
            } else {
                format!("请求失败: {}", e)
            }
        })?;

        if !response.status().is_success() {
            return Err(format!("API 返回错误: {}", response.status()));
        }

        Ok(())
    }

    pub async fn like(&self, tweet_id: &str, tab_id: Option<i32>) -> Result<(), String> {
        let url = format!("{}/api/v1/x/likes", self.base_url);
        let body = serde_json::json!({
            "tweetId": tweet_id,
            "tabId": tab_id,
        });

        let response = self.client.post(&url).json(&body).send().await.map_err(|e| {
            if e.is_connect() {
                "无法连接到 LocalBridge".to_string()
            } else {
                format!("请求失败: {}", e)
            }
        })?;

        if !response.status().is_success() {
            return Err(format!("API 返回错误: {}", response.status()));
        }

        Ok(())
    }

    fn parse_tweets_from_timeline(&self, raw: &serde_json::Value) -> Result<Vec<XTweet>, String> {
        let mut tweets = Vec::new();

        let entries = raw
            .get("data")
            .and_then(|d| d.get("home"))
            .and_then(|h| h.get("home_timeline_urt"))
            .and_then(|t| t.get("instructions"))
            .and_then(|i| i.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|inst| inst.get("type").and_then(|t| t.as_str()) == Some("TimelineAddEntries"))
            })
            .and_then(|inst| inst.get("entries"))
            .and_then(|e| e.as_array());

        if let Some(entries_arr) = entries {
            for entry in entries_arr {
                if let Some(tweet) = self.parse_tweet_entry(entry) {
                    tweets.push(tweet);
                }
            }
        }

        Ok(tweets)
    }

    fn parse_tweet_entry(&self, entry: &serde_json::Value) -> Option<XTweet> {
        let content = entry.get("content")?;
        let item_content = content.get("itemContent")?;
        let tweet_results = item_content.get("tweet_results")?;
        let result = tweet_results.get("result")?;

        self.parse_tweet_result(result)
    }

    fn parse_tweet_result(&self, result: &serde_json::Value) -> Option<XTweet> {
        let legacy = result.get("legacy")?;
        let core = result.get("core")?;
        let user_results = core.get("user_results")?;
        let user_result = user_results.get("result")?;

        let tweet_id = result.get("rest_id")?.as_str()?.to_string();
        let text = legacy.get("full_text")?.as_str()?.to_string();
        let created_at = legacy.get("created_at").and_then(|v| v.as_str()).map(String::from);

        let author = self.parse_user_result(user_result);

        let like_count = legacy.get("favorite_count").and_then(|v| v.as_i64());
        let retweet_count = legacy.get("retweet_count").and_then(|v| v.as_i64());
        let reply_count = legacy.get("reply_count").and_then(|v| v.as_i64());
        let view_count = result.get("views")
            .and_then(|v| v.get("count"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<i64>().ok());

        Some(XTweet {
            id: tweet_id,
            text,
            created_at,
            author,
            like_count,
            retweet_count,
            reply_count,
            view_count,
        })
    }

    fn parse_user_from_response(&self, raw: &serde_json::Value) -> Result<XUser, String> {
        let user_result = raw
            .get("data")
            .and_then(|d| d.get("user"))
            .and_then(|u| u.get("result"))
            .ok_or_else(|| "无法解析用户数据".to_string())?;

        self.parse_user_result(user_result)
            .ok_or_else(|| "用户数据格式错误".to_string())
    }

    fn parse_user_result(&self, result: &serde_json::Value) -> Option<XUser> {
        let legacy = result.get("legacy")?;

        Some(XUser {
            id: result.get("rest_id").and_then(|v| v.as_str()).map(String::from),
            name: legacy.get("name").and_then(|v| v.as_str()).map(String::from),
            screen_name: legacy.get("screen_name").and_then(|v| v.as_str()).map(String::from),
            description: legacy.get("description").and_then(|v| v.as_str()).map(String::from),
            followers_count: legacy.get("followers_count").and_then(|v| v.as_i64()),
            following_count: legacy.get("friends_count").and_then(|v| v.as_i64()),
            tweet_count: legacy.get("statuses_count").and_then(|v| v.as_i64()),
            profile_image_url: legacy.get("profile_image_url_https").and_then(|v| v.as_str()).map(String::from),
        })
    }

    fn parse_tweet_from_response(&self, raw: &serde_json::Value) -> Result<XTweet, String> {
        let tweet_result = raw
            .get("data")
            .and_then(|d| d.get("tweetResult"))
            .and_then(|t| t.get("result"))
            .ok_or_else(|| "无法解析推文数据".to_string())?;

        self.parse_tweet_result(tweet_result)
            .ok_or_else(|| "推文数据格式错误".to_string())
    }
}
