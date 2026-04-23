use crate::unified_timer::executor::TimerExecutor;
use crate::unified_timer::types::{ExecutionContext, ExecutionResult};
use async_trait::async_trait;
use chrono::{Utc, DateTime};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, PartialEq, Eq)]
struct AccountBindingSnapshot {
    instance_id: String,
    extension_name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnmanagedAccountRecord {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
    pub favourites_count: Option<i64>,
    pub listed_count: Option<i64>,
    pub media_count: Option<i64>,
    pub created_at: Option<String>,
    pub instance_id: String,
    pub extension_name: String,
    pub last_seen: String,
}

impl From<&crate::models::twitter_account::TwitterBasicAccount> for UnmanagedAccountRecord {
    fn from(account: &crate::models::twitter_account::TwitterBasicAccount) -> Self {
        Self {
            twitter_id: account.twitter_id.clone(),
            screen_name: account.screen_name.clone(),
            display_name: account.display_name.clone(),
            avatar_url: account.avatar_url.clone(),
            description: account.description.clone(),
            is_verified: account.is_verified,
            followers_count: account.followers_count,
            following_count: account.following_count,
            tweet_count: account.tweet_count,
            favourites_count: account.favourites_count,
            listed_count: account.listed_count,
            media_count: account.media_count,
            created_at: account.created_at.clone(),
            instance_id: account.instance_id.clone(),
            extension_name: account.extension_name.clone(),
            last_seen: account.last_seen.to_rfc3339(),
        }
    }
}

fn should_insert_snapshot(last_snapshot_time: Option<String>) -> bool {
    match last_snapshot_time {
        Some(last_snapshot_time) => match chrono::DateTime::parse_from_rfc3339(&last_snapshot_time) {
            Ok(last_snapshot_time) => {
                let now = Utc::now();
                let elapsed = now.signed_duration_since(last_snapshot_time.with_timezone(&Utc));
                elapsed.num_hours() >= 1
            }
            Err(_) => true,
        },
        None => true,
    }
}

async fn process_user_info(
    instance_name: String,
    instance_id: String,
    basic_info: crate::services::localbridge::XUser,
    db: Arc<Mutex<crate::task_database::TaskDatabase>>,
    binding_cache: Arc<Mutex<HashMap<String, AccountBindingSnapshot>>>,
    unmanaged_accounts: Arc<Mutex<HashMap<String, UnmanagedAccountRecord>>>,
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

    // 2. Check database and decide how to store/update the account
    let db_guard = db.lock().unwrap();
    match db_guard.get_account_management_detail(&account.twitter_id) {
            Ok(Some(account_row)) if account_row.is_managed => {
                let latest_binding = AccountBindingSnapshot {
                    instance_id: account.instance_id.clone(),
                    extension_name: account.extension_name.clone(),
                };

                let should_update_binding = binding_cache
                    .lock()
                    .unwrap()
                    .get(&account.twitter_id)
                    .map(|cached| cached != &latest_binding)
                    .unwrap_or(true);

                if should_update_binding {
                    match db_guard.update_account_instance_binding(
                        &account.twitter_id,
                        Some(account.instance_id.as_str()),
                        Some(account.extension_name.as_str()),
                    ) {
                        Ok(updated) => {
                            if updated {
                                binding_cache
                                    .lock()
                                    .unwrap()
                                    .insert(account.twitter_id.clone(), latest_binding);
                            }
                        }
                        Err(e) => {
                            log::error!("[process_user_info] Failed to update account binding: {}", e);
                        }
                    }
                }

                match db_guard.get_account_last_snapshot_time(&account.twitter_id) {
                    Ok(last_snapshot_time) => {
                        if should_insert_snapshot(last_snapshot_time) {
                            if let Err(e) = db_guard.insert_account_snapshot(&account) {
                                log::error!("[process_user_info] Failed to insert account snapshot: {}", e);
                            } else {
                                log::info!("[process_user_info] Account snapshot inserted successfully");
                            }
                        } else {
                            log::debug!("[process_user_info] Skipping snapshot for managed account {} (last snapshot < 1h)", account.twitter_id);
                        }
                    }
                    Err(e) => {
                        log::error!("[process_user_info] Failed to query latest snapshot time: {}", e);
                    }
                }

                unmanaged_accounts.lock().unwrap().remove(&account.twitter_id);
            }
            Ok(Some(_account_row)) => {
                // Historical managed account: keep record in x_accounts, but don't track as unmanaged-online.
                unmanaged_accounts.lock().unwrap().remove(&account.twitter_id);
                log::debug!("[process_user_info] Historical account {} observed online but excluded from unmanaged-online group", account.twitter_id);
            }
            Ok(None) => {
                unmanaged_accounts
                    .lock()
                    .unwrap()
                    .insert(account.twitter_id.clone(), UnmanagedAccountRecord::from(&account));
                log::info!("[process_user_info] Account {} tracked as unmanaged-online", account.twitter_id);
            }
            Err(e) => {
                log::error!("[process_user_info] Database query failed: {}", e);
            }
        }

    // 3. TODO: Notify UI about data changes
    log::debug!("[process_user_info] UI notification not yet implemented");
}

pub struct LocalBridgeSyncExecutor {
    last_user_info_query: Mutex<HashMap<String, DateTime<Utc>>>,
    account_binding_cache: Arc<Mutex<HashMap<String, AccountBindingSnapshot>>>,
    unmanaged_online_accounts: Arc<Mutex<HashMap<String, UnmanagedAccountRecord>>>,
    db: Arc<Mutex<crate::task_database::TaskDatabase>>,
}

impl LocalBridgeSyncExecutor {
    pub fn new(db: Arc<Mutex<crate::task_database::TaskDatabase>>) -> Self {
        let account_binding_cache = {
            let db_guard = db.lock().unwrap();
            let managed_accounts = db_guard.get_managed_accounts().unwrap_or_default();
            let mut cache = HashMap::new();
            for account in managed_accounts {
                if let (Some(instance_id), Some(extension_name)) = (account.instance_id, account.extension_name) {
                    cache.insert(
                        account.twitter_id,
                        AccountBindingSnapshot {
                            instance_id,
                            extension_name,
                        },
                    );
                }
            }
            Arc::new(Mutex::new(cache))
        };

        Self {
            last_user_info_query: Mutex::new(HashMap::new()),
            account_binding_cache,
            unmanaged_online_accounts: Arc::new(Mutex::new(HashMap::new())),
            db,
        }
    }

    pub fn get_unmanaged_online_accounts(&self) -> Vec<UnmanagedAccountRecord> {
        self.unmanaged_online_accounts
            .lock()
            .unwrap()
            .values()
            .cloned()
            .collect()
    }

    pub fn get_unmanaged_online_account(&self, twitter_id: &str) -> Option<UnmanagedAccountRecord> {
        self.unmanaged_online_accounts
            .lock()
            .unwrap()
            .get(twitter_id)
            .cloned()
    }

    pub fn remove_unmanaged_online_account(&self, twitter_id: &str) {
        self.unmanaged_online_accounts
            .lock()
            .unwrap()
            .remove(twitter_id);
    }

    fn prune_unmanaged_online_accounts(&self, active_instance_ids: &HashSet<String>) {
        self.unmanaged_online_accounts
            .lock()
            .unwrap()
            .retain(|_, account| active_instance_ids.contains(&account.instance_id));
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
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

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

        let mut online_instance_ids = HashSet::new();
        let mut resolved_instance_ids = HashSet::new();

        let mut handles = Vec::new();

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
            online_instance_ids.insert(instance_id.to_string());

            // 检查是否需要查询用户信息
            if self.should_query_user_info(instance_id) {
                match client.get_basic_info_with_instance(instance_id).await {
                    Ok(basic_info) => {
                        resolved_instance_ids.insert(instance_id.to_string());
                        if let Some(twitter_id) = basic_info.id.clone() {
                            log::debug!("[LocalBridgeSyncExecutor] Resolved twitter_id {} for instance {}", twitter_id, instance_id);
                        }

                        let instance_name_clone = instance_name.to_string();
                        let instance_id_clone = instance_id.to_string();
                        let db_clone = self.db.clone();
                        let binding_cache_clone = self.account_binding_cache.clone();
                        let unmanaged_accounts_clone = self.unmanaged_online_accounts.clone();
                        handles.push(tokio::spawn(process_user_info(
                            instance_name_clone,
                            instance_id_clone,
                            basic_info,
                            db_clone,
                            binding_cache_clone,
                            unmanaged_accounts_clone,
                        )));

                        // 更新查询时间
                        self.update_query_time(instance_id);
                    }
                    Err(e) => {
                        log::warn!("[LocalBridgeSyncExecutor] Failed to get user info for {}: {}", instance_name, e);
                    }
                }
            }
        }

        for handle in handles {
            if let Err(e) = handle.await {
                log::warn!("[LocalBridgeSyncExecutor] process_user_info task join failed: {}", e);
            }
        }

        self.prune_unmanaged_online_accounts(&online_instance_ids);
        let unmanaged_count = self.unmanaged_online_accounts.lock().unwrap().len();
        log::info!(
            "[LocalBridgeSyncExecutor] Sync round summary: instances={}, online_instance_ids={}, resolved_instance_ids={}, unmanaged_online_accounts={}",
            instances.len(),
            online_instance_ids.len(),
            resolved_instance_ids.len(),
            unmanaged_count
        );

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
