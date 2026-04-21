use serde::{Deserialize, Serialize};
use crate::services::storage;

const AI_CONFIG_FILE: &str = "ai_config.json";

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
    let mut config: AiSettings = storage::read_json(AI_CONFIG_FILE, AiSettings::default())?;
    config.ensure_valid_active_provider();
    Ok(config)
}

pub fn save_config(config: &AiSettings) -> Result<(), String> {
    storage::write_json(AI_CONFIG_FILE, config)
}
