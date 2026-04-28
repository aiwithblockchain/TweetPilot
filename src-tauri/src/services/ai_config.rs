use crate::services::settings_store;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSettings {
    pub active_provider: String,
    pub providers: Vec<ProviderConfig>,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            active_provider: "anthropic".to_string(),
            providers: vec![
                ProviderConfig {
                    id: "anthropic".to_string(),
                    name: "Anthropic".to_string(),
                    api_key: String::new(),
                    base_url: Some("https://api.anthropic.com".to_string()),
                    model: "claude-sonnet-4-6".to_string(),
                    enabled: true,
                },
            ],
        }
    }
}

impl AiSettings {
    pub fn get_active_provider(&self) -> Option<&ProviderConfig> {
        self.providers.iter().find(|p| p.id == self.active_provider)
    }

    pub fn ensure_valid_active_provider(&mut self) {
        if !self.providers.iter().any(|p| p.id == self.active_provider) {
            if let Some(first) = self.providers.first() {
                self.active_provider = first.id.clone();
            }
        }
    }
}

pub fn load_config() -> Result<AiSettings, String> {
    settings_store::get_ai_settings()
}

pub fn save_config(config: &AiSettings) -> Result<(), String> {
    settings_store::save_ai_settings(config)
}
