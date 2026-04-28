use serde::{Deserialize, Serialize};

use crate::services::{ai_config::AiSettings, storage};

const SETTINGS_FILE: &str = "settings.json";
const SETTINGS_VERSION: u32 = 1;
const STARTUP_HOME: &str = "workspace-selector";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preferences {
    pub language: String,
    pub theme: String,
    pub startup: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalBridgeConfig {
    pub endpoint: String,
    pub timeout_ms: u64,
    pub sync_interval_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsUi {
    pub language: String,
    pub theme: String,
    pub startup: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub version: u32,
    pub ui: SettingsUi,
    pub ai: AiSettings,
    pub local_bridge: LocalBridgeConfig,
}

pub fn default_preferences() -> Preferences {
    Preferences {
        language: "zh-CN".to_string(),
        theme: "dark".to_string(),
        startup: STARTUP_HOME.to_string(),
    }
}

pub fn default_local_bridge_config() -> LocalBridgeConfig {
    LocalBridgeConfig {
        endpoint: "http://127.0.0.1:10088".to_string(),
        timeout_ms: 30000,
        sync_interval_ms: 60000,
    }
}

pub fn default_settings() -> Settings {
    let preferences = default_preferences();
    Settings {
        version: SETTINGS_VERSION,
        ui: SettingsUi {
            language: preferences.language,
            theme: preferences.theme,
            startup: preferences.startup,
        },
        ai: AiSettings::default(),
        local_bridge: default_local_bridge_config(),
    }
}

pub fn load_settings() -> Result<Settings, String> {
    let mut settings: Settings = storage::read_json(SETTINGS_FILE, default_settings())?;
    settings.version = SETTINGS_VERSION;
    settings.ai.ensure_valid_active_provider();
    normalize_startup(&mut settings.ui.startup);
    Ok(settings)
}

pub fn save_settings(settings: &Settings) -> Result<(), String> {
    let mut normalized = settings.clone();
    normalized.version = SETTINGS_VERSION;
    normalized.ai.ensure_valid_active_provider();
    normalize_startup(&mut normalized.ui.startup);
    storage::write_json(SETTINGS_FILE, &normalized)
}

pub fn get_preferences() -> Result<Preferences, String> {
    let settings = load_settings()?;
    Ok(Preferences {
        language: settings.ui.language,
        theme: settings.ui.theme,
        startup: settings.ui.startup,
    })
}

pub fn save_preferences(preferences: &Preferences) -> Result<(), String> {
    let mut settings = load_settings()?;
    settings.ui.language = preferences.language.clone();
    settings.ui.theme = preferences.theme.clone();
    settings.ui.startup = preferences.startup.clone();
    save_settings(&settings)
}

pub fn get_local_bridge_config() -> Result<LocalBridgeConfig, String> {
    Ok(load_settings()?.local_bridge)
}

pub fn update_local_bridge_config(config: &LocalBridgeConfig) -> Result<(), String> {
    let mut settings = load_settings()?;
    settings.local_bridge = config.clone();
    save_settings(&settings)
}

pub fn get_ai_settings() -> Result<AiSettings, String> {
    Ok(load_settings()?.ai)
}

pub fn save_ai_settings(config: &AiSettings) -> Result<(), String> {
    let mut settings = load_settings()?;
    settings.ai = config.clone();
    save_settings(&settings)
}

fn normalize_startup(startup: &mut String) {
    if startup.trim().is_empty() || startup == "last-workspace" {
        *startup = STARTUP_HOME.to_string();
    }
}
