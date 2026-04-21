use tauri::{State, Window};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use crate::claurst_session::ClaurstSession;
use crate::services::ai_config::{self, AiSettings};

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

    let settings = ai_config::load_config()
        .map_err(|e| format!("Failed to load AI settings: {}", e))?;

    let active_provider = settings.get_active_provider()
        .ok_or("No active provider configured. Please configure AI providers in settings.".to_string())?;

    if active_provider.api_key.is_empty() {
        return Err(format!("API key not configured for provider '{}'. Please configure in settings.", active_provider.name));
    }

    let session_id = format!("session-{}", uuid::Uuid::new_v4());

    let session = ClaurstSession::new(
        session_id.clone(),
        std::path::PathBuf::from(&working_dir),
        active_provider.api_key.clone(),
        active_provider.model.clone(),
        active_provider.base_url.clone(),
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
) -> Result<String, String> {
    let cancel_token = CancellationToken::new();
    let request_id = uuid::Uuid::new_v4().to_string();

    // Set up cancellation token and request ID
    *state.cancel_token.lock().await = Some(cancel_token.clone());
    *state.active_request_id.lock().await = Some(request_id.clone());

    // Clone what we need for the background task
    let request_id_clone = request_id.clone();
    let session_arc = state.session.clone();
    let cancel_token_arc = state.cancel_token.clone();
    let active_request_id_arc = state.active_request_id.clone();

    // Spawn the message sending in background
    tokio::spawn(async move {
        let mut session_guard = session_arc.lock().await;
        if let Some(session) = session_guard.as_mut() {
            let _ = session.send_message(&message, &request_id_clone, window, cancel_token.clone()).await;
        }

        // Clear state after completion
        *cancel_token_arc.lock().await = None;
        *active_request_id_arc.lock().await = None;
    });

    // Return request_id immediately so frontend can start listening
    Ok(request_id)
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
