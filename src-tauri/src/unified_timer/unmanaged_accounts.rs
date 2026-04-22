use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use crate::models::twitter_account::TwitterBasicAccount;

// Global in-memory storage for unmanaged online accounts
pub static UNMANAGED_ACCOUNTS: Lazy<Mutex<HashMap<String, TwitterBasicAccount>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub fn add_unmanaged_account(account: TwitterBasicAccount) {
    let twitter_id = account.twitter_id.clone();
    let display_name = account.display_name.clone();
    let screen_name = account.screen_name.clone();

    let mut accounts = UNMANAGED_ACCOUNTS.lock().unwrap();
    accounts.insert(twitter_id, account);

    log::info!("[UnmanagedAccounts] Added account: {} (@{})",
        display_name, screen_name
    );
}

pub fn get_unmanaged_accounts() -> Vec<TwitterBasicAccount> {
    let accounts = UNMANAGED_ACCOUNTS.lock().unwrap();
    accounts.values().cloned().collect()
}

pub fn remove_unmanaged_account(twitter_id: &str) {
    let mut accounts = UNMANAGED_ACCOUNTS.lock().unwrap();
    if let Some(account) = accounts.remove(twitter_id) {
        log::info!("[UnmanagedAccounts] Removed account: {} (@{})",
            account.display_name, account.screen_name);
    }
}

pub fn clear_unmanaged_accounts() {
    let mut accounts = UNMANAGED_ACCOUNTS.lock().unwrap();
    accounts.clear();
    log::info!("[UnmanagedAccounts] Cleared all unmanaged accounts");
}
