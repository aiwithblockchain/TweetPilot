use tauri::{State, Window};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use crate::claurst_session::ClaurstSession;
use crate::services::ai_config::{self, AiSettings};
use crate::services::conversation_storage::LoadedSession;
use crate::services::{resource_installer, session_constraints};

fn build_session_system_prompt(working_dir: &std::path::Path) -> Result<session_constraints::SessionConstraints, String> {
    session_constraints::build_session_constraints(working_dir, None)
}

fn ensure_global_ai_resources_ready() -> Result<(), String> {
    let resource_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    resource_installer::ensure_bundled_home_installed(&resource_dir)
}

fn log_system_prompt(context: &str, working_dir: &str, included_sources: &[String], system_prompt: &str) {
    let included_sources = included_sources.join(", ");
    log::info!(
        "[ai] Built system prompt for {} workspace {} ({} chars); included: [{}]",
        context,
        working_dir,
        system_prompt.chars().count(),
        included_sources
    );
    log::info!(
        "[ai] System prompt content for {} workspace {}:\n{}",
        context,
        working_dir,
        system_prompt
    );
}

pub struct AiState {
    pub session: Arc<Mutex<Option<ClaurstSession>>>,
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    pub active_request_id: Arc<Mutex<Option<String>>>,
}

#[tauri::command]
pub async fn init_ai_session(
    working_dir: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    if !std::path::Path::new(&working_dir).exists() {
        return Err(format!("Directory does not exist: {}", working_dir));
    }

    ensure_global_ai_resources_ready()?;

    let settings = ai_config::load_config()
        .map_err(|e| format!("Failed to load AI settings: {}", e))?;

    let active_provider = settings.get_active_provider()
        .ok_or("No active provider configured. Please configure AI providers in settings.".to_string())?;

    let system_prompt_constraints = build_session_system_prompt(std::path::Path::new(&working_dir))?;
    let included_sources = system_prompt_constraints.included_sources().to_vec();
    let system_prompt = system_prompt_constraints.into_system_prompt();
    log_system_prompt("init_ai_session", &working_dir, &included_sources, &system_prompt);

    let session_id = format!("session-{}", uuid::Uuid::new_v4());

    let session = ClaurstSession::new(
        session_id.clone(),
        std::path::PathBuf::from(&working_dir),
        active_provider.api_key.clone(),
        active_provider.model.clone(),
        active_provider.base_url.clone(),
        Some(system_prompt),
    ).map_err(|e| format!("Failed to create AI session: {}", e))?;

    *state.session.lock().await = Some(session);
    *state.cancel_token.lock().await = None;
    *state.active_request_id.lock().await = None;

    Ok(session_id)
}

#[tauri::command]
pub async fn send_ai_message(
    message: String,
    state: State<'_, AiState>,
    window: Window,
) -> Result<serde_json::Value, String> {
    let cancel_token = CancellationToken::new();
    let request_id = uuid::Uuid::new_v4().to_string();

    *state.cancel_token.lock().await = Some(cancel_token.clone());
    *state.active_request_id.lock().await = Some(request_id.clone());

    let request_id_clone = request_id.clone();
    let session_arc = state.session.clone();
    let cancel_token_arc = state.cancel_token.clone();
    let active_request_id_arc = state.active_request_id.clone();

    tokio::spawn(async move {
        tokio::task::yield_now().await;

        let mut session_guard = session_arc.lock().await;
        if let Some(session) = session_guard.as_mut() {
            let _ = session.send_message(&message, &request_id_clone, window, cancel_token.clone()).await;
        }

        *cancel_token_arc.lock().await = None;
        *active_request_id_arc.lock().await = None;
    });

    Ok(serde_json::json!({
        "request_id": request_id,
    }))
}

#[tauri::command]
pub async fn cancel_ai_message(
    state: State<'_, AiState>,
) -> Result<(), String> {
    let active_request_id = state.active_request_id.lock().await.clone();
    if active_request_id.is_none() {
        return Err("No active message to cancel".to_string());
    }

    let cancel_token_guard = state.cancel_token.lock().await;
    if let Some(token) = cancel_token_guard.as_ref() {
        token.cancel();
        Ok(())
    } else {
        Err("No active message to cancel".to_string())
    }
}

#[tauri::command]
pub async fn clear_ai_session(
    state: State<'_, AiState>,
) -> Result<(), String> {
    let session_guard = state.session.lock().await;

    if let Some(session) = session_guard.as_ref() {
        let session_id = session.get_session_id();

        let storage = crate::services::conversation_storage::ConversationStorage::new()
            .map_err(|e| format!("Failed to create storage: {}", e))?;

        storage.clear_messages(session_id)
            .map_err(|e| format!("Failed to clear messages: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_ai_config() -> Result<AiSettings, String> {
    ai_config::load_config()
}

#[tauri::command]
pub async fn save_ai_config(config: AiSettings) -> Result<(), String> {
    ai_config::save_config(&config)
}

#[tauri::command]
pub async fn list_ai_sessions() -> Result<Vec<crate::services::conversation_storage::SessionMetadata>, String> {
    let storage = crate::services::conversation_storage::ConversationStorage::new()?;
    storage.list_sessions()
}

#[tauri::command]
pub async fn get_session_metadata(session_id: String) -> Result<crate::services::conversation_storage::SessionMetadata, String> {
    let storage = crate::services::conversation_storage::ConversationStorage::new()?;
    storage.get_session_metadata(&session_id)
}

#[tauri::command]
pub async fn load_ai_session(
    session_id: String,
) -> Result<LoadedSession, String> {
    let storage = crate::services::conversation_storage::ConversationStorage::new()?;
    storage.load_session(&session_id)
}

#[tauri::command]
pub async fn delete_ai_session(session_id: String) -> Result<(), String> {
    let storage = crate::services::conversation_storage::ConversationStorage::new()?;
    storage.delete_session(&session_id)
}

#[tauri::command]
pub async fn create_new_session(
    working_dir: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    if !std::path::Path::new(&working_dir).exists() {
        return Err(format!("Directory does not exist: {}", working_dir));
    }

    ensure_global_ai_resources_ready()?;

    let settings = ai_config::load_config()
        .map_err(|e| format!("Failed to load AI settings: {}", e))?;

    let active_provider = settings.get_active_provider()
        .ok_or("No active provider configured".to_string())?;

    let system_prompt_constraints = build_session_system_prompt(std::path::Path::new(&working_dir))?;
    let included_sources = system_prompt_constraints.included_sources().to_vec();
    let system_prompt = system_prompt_constraints.into_system_prompt();
    log_system_prompt("create_new_session", &working_dir, &included_sources, &system_prompt);

    let session_id = format!("session-{}", uuid::Uuid::new_v4());

    let session = ClaurstSession::new(
        session_id.clone(),
        std::path::PathBuf::from(&working_dir),
        active_provider.api_key.clone(),
        active_provider.model.clone(),
        active_provider.base_url.clone(),
        Some(system_prompt),
    ).map_err(|e| format!("Failed to create AI session: {}", e))?;

    *state.session.lock().await = Some(session);
    *state.cancel_token.lock().await = None;
    *state.active_request_id.lock().await = None;

    Ok(session_id)
}

#[cfg(test)]
mod tests {
    use super::build_session_system_prompt;
    use crate::services::test_home_guard::home_test_lock;
    use std::fs;
    use uuid::Uuid;

    fn with_test_home_and_workspace<T>(
        name: &str,
        setup_workspace: impl FnOnce(&std::path::Path),
        test: impl FnOnce(std::path::PathBuf) -> T,
    ) -> T {
        let _guard = home_test_lock().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let temp_root = std::env::temp_dir().join(format!(
            "tweetpilot-ai-command-tests-{}-{}",
            name,
            Uuid::new_v4()
        ));
        let home_dir = temp_root.join("home");
        let workspace_dir = temp_root.join("workspace");
        let tweetpilot_home = home_dir.join(".tweetpilot");
        let workspace_tweetpilot = workspace_dir.join(".tweetpilot");

        let previous_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", &home_dir);

        fs::create_dir_all(&tweetpilot_home).expect("create tweetpilot home dir");
        fs::create_dir_all(&workspace_tweetpilot).expect("create workspace tweetpilot dir");
        fs::write(tweetpilot_home.join("skill.md"), "global skill").expect("write skill");
        setup_workspace(&workspace_tweetpilot);

        let result = test(workspace_dir.clone());

        if let Some(home) = previous_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }

        let _ = fs::remove_dir_all(&temp_root);
        result
    }

    #[test]
    fn build_session_system_prompt_includes_only_skill_doc() {
        with_test_home_and_workspace(
            "skill-only",
            |workspace_tweetpilot| {
                fs::write(workspace_tweetpilot.join("product.md"), "product doc")
                    .expect("write product doc");
                fs::write(workspace_tweetpilot.join("content_rules.md"), "forbidden words")
                    .expect("write content rules doc");
            },
            |workspace_dir| {
                let constraints = build_session_system_prompt(&workspace_dir)
                    .expect("build session prompt");

                assert_eq!(constraints.included_sources().len(), 1);
                assert!(constraints.included_sources()[0].ends_with(".tweetpilot/skill.md"));
                assert_eq!(constraints.into_system_prompt(), "global skill");
            },
        );
    }

    #[test]
    fn build_session_system_prompt_returns_error_when_skill_doc_is_missing() {
        with_test_home_and_workspace(
            "missing-skill-doc",
            |_| {},
            |workspace_dir| {
                let tweetpilot_home = std::env::var("HOME").expect("home env");
                fs::remove_file(std::path::Path::new(&tweetpilot_home).join(".tweetpilot").join("skill.md"))
                    .expect("remove skill doc");

                let error = build_session_system_prompt(&workspace_dir)
                    .expect_err("missing skill doc should fail");

                assert_eq!(error, "全局约束文档 skill.md 缺失");
            },
        );
    }
}
