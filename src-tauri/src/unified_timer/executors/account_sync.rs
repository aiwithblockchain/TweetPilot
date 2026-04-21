use crate::unified_timer::types::{ExecutionContext, ExecutionResult};
use crate::unified_timer::executor::TimerExecutor;
use crate::commands::account;
use async_trait::async_trait;

pub struct AccountSyncExecutor;

#[async_trait]
impl TimerExecutor for AccountSyncExecutor {
    async fn execute(&self, context: ExecutionContext) -> Result<ExecutionResult, String> {
        let start_time = chrono::Utc::now();

        log::info!("[AccountSync] Starting account status sync");

        match account::refresh_all_accounts_status().await {
            Ok(_) => {
                match account::get_mapped_accounts().await {
                    Ok(accounts) => {
                        log::info!("[AccountSync] Account status refreshed successfully");
                        log::info!("[AccountSync] Current mapped accounts: {}", accounts.len());
                        for account in &accounts {
                            log::debug!("[AccountSync]   - {} (@{}) | Status: {:?} | Last verified: {}",
                                account.display_name,
                                account.screen_name.trim_start_matches('@'),
                                account.status,
                                account.last_verified
                            );
                        }

                        let end_time = chrono::Utc::now();
                        let duration = (end_time - start_time).num_milliseconds() as f64 / 1000.0;

                        Ok(ExecutionResult {
                            timer_id: context.timer_id,
                            start_time,
                            end_time,
                            duration,
                            success: true,
                            output: format!("成功同步 {} 个账号", accounts.len()),
                            error: None,
                        })
                    }
                    Err(e) => {
                        log::error!("[AccountSync] Failed to get account list: {}", e);

                        let end_time = chrono::Utc::now();
                        let duration = (end_time - start_time).num_milliseconds() as f64 / 1000.0;

                        Ok(ExecutionResult {
                            timer_id: context.timer_id,
                            start_time,
                            end_time,
                            duration,
                            success: false,
                            output: String::new(),
                            error: Some(format!("获取账号列表失败: {}", e)),
                        })
                    }
                }
            }
            Err(e) => {
                log::error!("[AccountSync] Failed to refresh account status: {}", e);

                let end_time = chrono::Utc::now();
                let duration = (end_time - start_time).num_milliseconds() as f64 / 1000.0;

                Ok(ExecutionResult {
                    timer_id: context.timer_id,
                    start_time,
                    end_time,
                    duration,
                    success: false,
                    output: String::new(),
                    error: Some(format!("刷新账号状态失败: {}", e)),
                })
            }
        }
    }

    fn timeout(&self) -> Option<std::time::Duration> {
        Some(std::time::Duration::from_secs(30))
    }
}
