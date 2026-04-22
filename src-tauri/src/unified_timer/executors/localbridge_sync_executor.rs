use crate::unified_timer::executor::TimerExecutor;
use crate::unified_timer::types::{ExecutionContext, ExecutionResult};
use async_trait::async_trait;
use chrono::{Utc, DateTime};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

async fn process_user_info(
    instance_name: String,
    instance_id: String,
    basic_info: crate::services::localbridge::XUser,
    db: Arc<Mutex<Option<crate::task_database::TaskDatabase>>>,
) {
    log::info!("[process_user_info] Processing user info for instance: {}", instance_name);

    // 1. Parse XUser into TwitterBasicAccount
    let account = match crate::models::twitter_account::TwitterBasicAccount::from_xuser(
        basic_info.clone(),
        instance_id.clone(),
        instance_name.clone(),
    ) {
        Some(acc) => acc,
        None => {
            log::warn!("[process_user_info] Failed to parse user info: missing twitter_id");
            return;
        }
    };

    // Print detailed account information
    log::info!("[process_user_info] ========== Twitter Account Details ==========");
    log::info!("[process_user_info] Twitter ID: {}", account.twitter_id);
    log::info!("[process_user_info] Screen Name: @{}", account.screen_name);
    log::info!("[process_user_info] Display Name: {}", account.display_name);
    log::info!("[process_user_info] Instance ID: {}", account.instance_id);
    log::info!("[process_user_info] Extension Name: {}", account.extension_name);
    log::info!("[process_user_info] Is Verified: {}", account.is_verified);

    if let Some(ref avatar) = account.avatar_url {
        log::info!("[process_user_info] Avatar URL: {}", avatar);
    }

    if let Some(ref desc) = account.description {
        log::info!("[process_user_info] Bio: {}", desc);
    }

    if let Some(followers) = account.followers_count {
        log::info!("[process_user_info] Followers: {}", followers);
    }

    if let Some(following) = account.following_count {
        log::info!("[process_user_info] Following: {}", following);
    }

    if let Some(tweets) = account.tweet_count {
        log::info!("[process_user_info] Tweets: {}", tweets);
    }

    if let Some(favourites) = account.favourites_count {
        log::info!("[process_user_info] Likes: {}", favourites);
    }

    if let Some(listed) = account.listed_count {
        log::info!("[process_user_info] Listed: {}", listed);
    }

    if let Some(media) = account.media_count {
        log::info!("[process_user_info] Media: {}", media);
    }

    if let Some(ref created) = account.created_at {
        log::info!("[process_user_info] Account Created: {}", created);
    }

    log::info!("[process_user_info] Last Seen: {}", account.last_seen);
    log::info!("[process_user_info] ============================================");

    // 2. Check database and decide insert/update
    let db_guard = db.lock().unwrap();
    if let Some(ref database) = *db_guard {
        match database.get_account_last_update(&account.twitter_id) {
            Ok(Some(last_update)) => {
                // Account exists in database
                match chrono::DateTime::parse_from_rfc3339(&last_update) {
                    Ok(last_update_time) => {
                        let now = Utc::now();
                        let elapsed = now.signed_duration_since(last_update_time.with_timezone(&Utc));
                        let elapsed_hours = elapsed.num_hours();

                        if elapsed_hours >= 1 {
                            // Update if more than 1 hour
                            log::info!("[process_user_info] Updating account {} (last update: {} hours ago)",
                                account.twitter_id, elapsed_hours);
                            if let Err(e) = database.update_account(&account) {
                                log::error!("[process_user_info] Failed to update account: {}", e);
                            } else {
                                log::info!("[process_user_info] Account updated successfully");
                            }
                        } else {
                            log::debug!("[process_user_info] Skipping update for {} (last update: {} hours ago)",
                                account.twitter_id, elapsed_hours);
                        }
                    }
                    Err(e) => {
                        log::error!("[process_user_info] Failed to parse last_update time: {}", e);
                    }
                }
            }
            Ok(None) => {
                // Account does not exist, insert new record
                log::info!("[process_user_info] Inserting new account: {}", account.twitter_id);
                if let Err(e) = database.insert_account(&account) {
                    log::error!("[process_user_info] Failed to insert account: {}", e);
                } else {
                    log::info!("[process_user_info] Account inserted successfully");
                    // Add to unmanaged accounts memory
                    crate::unified_timer::unmanaged_accounts::add_unmanaged_account(account.clone());
                }
            }
            Err(e) => {
                log::error!("[process_user_info] Database query failed: {}", e);
            }
        }
    } else {
        log::warn!("[process_user_info] Database not initialized");
    }

    // 3. TODO: Notify UI about data changes
    log::debug!("[process_user_info] UI notification not yet implemented");
}

pub struct LocalBridgeSyncExecutor {
    last_user_info_query: Mutex<HashMap<String, DateTime<Utc>>>,
    db: Arc<Mutex<Option<crate::task_database::TaskDatabase>>>,
}

impl LocalBridgeSyncExecutor {
    pub fn new(db: Arc<Mutex<Option<crate::task_database::TaskDatabase>>>) -> Self {
        Self {
            last_user_info_query: Mutex::new(HashMap::new()),
            db,
        }
    }

    fn should_query_user_info(&self, instance_id: &str) -> bool {
        let map = self.last_user_info_query.lock().unwrap();

        match map.get(instance_id) {
            None => {
                // 第一次发现这个实例，立即查询
                log::info!("[LocalBridgeSyncExecutor] First time seeing instance {}, will query user info", instance_id);
                true
            }
            Some(last_query_time) => {
                let now = Utc::now();
                let elapsed = now.signed_duration_since(*last_query_time);
                let elapsed_minutes = elapsed.num_minutes();

                if elapsed_minutes >= 5 {
                    log::info!("[LocalBridgeSyncExecutor] Instance {} last queried {} minutes ago, will query user info",
                        instance_id, elapsed_minutes);
                    true
                } else {
                    log::debug!("[LocalBridgeSyncExecutor] Instance {} last queried {} minutes ago, skipping user info query",
                        instance_id, elapsed_minutes);
                    false
                }
            }
        }
    }

    fn update_query_time(&self, instance_id: &str) {
        let mut map = self.last_user_info_query.lock().unwrap();
        map.insert(instance_id.to_string(), Utc::now());
    }
}

#[async_trait]
impl TimerExecutor for LocalBridgeSyncExecutor {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String> {
        let start_time = Utc::now();
        log::info!("[LocalBridgeSyncExecutor] Starting LocalBridge instance sync for timer {}", context.timer_id);

        let config = crate::commands::preferences::get_local_bridge_config()
            .await
            .map_err(|e| {
                log::error!("[LocalBridgeSyncExecutor] Failed to get LocalBridge config: {}", e);
                format!("Failed to get LocalBridge config: {}", e)
            })?;

        let client = crate::services::localbridge::LocalBridgeClient::new(
            config.endpoint.clone(),
            config.timeout_ms,
        )
        .map_err(|e| {
            log::error!("[LocalBridgeSyncExecutor] Failed to create LocalBridge client: {}", e);
            format!("Failed to create LocalBridge client: {}", e)
        })?;

        let instances = client.get_instances().await.map_err(|e| {
            log::error!("[LocalBridgeSyncExecutor] Failed to get instances: {}", e);
            format!("Failed to get instances: {}", e)
        })?;

        log::info!("[LocalBridgeSyncExecutor] Found {} instances from LocalBridge", instances.len());

        for instance in &instances {
            let instance_id = instance
                .get("instanceId")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let instance_name = instance
                .get("instanceName")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            log::info!("[LocalBridgeSyncExecutor] Instance: {} ({})", instance_name, instance_id);

            // 检查是否需要查询用户信息
            if self.should_query_user_info(instance_id) {
                match client.get_basic_info_with_instance(instance_id).await {
                    Ok(basic_info) => {
                        let instance_name_clone = instance_name.to_string();
                        let instance_id_clone = instance_id.to_string();
                        let db_clone = self.db.clone();
                        tokio::spawn(process_user_info(
                            instance_name_clone,
                            instance_id_clone,
                            basic_info,
                            db_clone,
                        ));

                        // 更新查询时间
                        self.update_query_time(instance_id);
                    }
                    Err(e) => {
                        log::warn!("[LocalBridgeSyncExecutor] Failed to get user info for {}: {}", instance_name, e);
                    }
                }
            }
        }

        let end_time = Utc::now();
        let duration = (end_time - start_time).num_milliseconds() as f64 / 1000.0;
        let output = format!(
            "LocalBridge sync completed: {} instances found",
            instances.len()
        );

        log::info!("[LocalBridgeSyncExecutor] {} in {:.3}s", output, duration);

        Ok(ExecutionResult {
            timer_id: context.timer_id,
            start_time,
            end_time,
            duration,
            success: true,
            output,
            error: None,
        })
    }
}
