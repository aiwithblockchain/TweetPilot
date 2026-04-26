use tauri::{State, Window};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use crate::claurst_session::ClaurstSession;
use crate::services::ai_config::{self, AiSettings, ProviderConfig};
use crate::services::ai_storage::{AiStorage, CreateSessionInput, LoadedSession, SessionMetadata};
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

fn ensure_workspace_exists(working_dir: &str) -> Result<(), String> {
    if !std::path::Path::new(working_dir).exists() {
        return Err(format!("Directory does not exist: {}", working_dir));
    }
    Ok(())
}

fn storage_for_workspace(working_dir: &str) -> Result<AiStorage, String> {
    ensure_workspace_exists(working_dir)?;
    AiStorage::new(working_dir)
}

fn resolve_provider(settings: &AiSettings, provider_id: Option<&str>) -> Result<ProviderConfig, String> {
    if let Some(provider_id) = provider_id {
        settings
            .providers
            .iter()
            .find(|provider| provider.id == provider_id)
            .cloned()
            .ok_or_else(|| format!("Configured provider '{}' for this session no longer exists", provider_id))
    } else {
        settings
            .get_active_provider()
            .cloned()
            .ok_or("No active provider configured. Please configure AI providers in settings.".to_string())
    }
}

async fn reset_runtime_state(state: &AiState) {
    *state.session.lock().await = None;
    *state.cancel_token.lock().await = None;
    *state.active_request_id.lock().await = None;
    *state.active_session_id.lock().await = None;
    *state.active_working_dir.lock().await = None;
}

async fn set_active_runtime_session(
    state: &AiState,
    session: ClaurstSession,
    session_id: String,
    working_dir: String,
) {
    *state.session.lock().await = Some(session);
    *state.cancel_token.lock().await = None;
    *state.active_request_id.lock().await = None;
    *state.active_session_id.lock().await = Some(session_id);
    *state.active_working_dir.lock().await = Some(working_dir);
}

async fn build_runtime_session(
    working_dir: &str,
    session_id: &str,
) -> Result<ClaurstSession, String> {
    ensure_workspace_exists(working_dir)?;
    ensure_global_ai_resources_ready()?;

    let storage = storage_for_workspace(working_dir)?;
    let loaded = storage.load_session(session_id)?;
    let runtime_config = storage
        .get_session_runtime_config(session_id)?
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let settings = ai_config::load_config()
        .map_err(|e| format!("Failed to load AI settings: {}", e))?;
    let provider = resolve_provider(&settings, runtime_config.2.as_deref())?;

    ClaurstSession::new(
        session_id.to_string(),
        std::path::PathBuf::from(working_dir),
        provider.api_key,
        runtime_config.0,
        provider.base_url,
        runtime_config.1,
        loaded.messages,
    )
    .map_err(|e| format!("Failed to activate AI session: {}", e))
}

pub struct AiState {
    pub session: Arc<Mutex<Option<ClaurstSession>>>,
    pub cancel_token: Arc<Mutex<Option<CancellationToken>>>,
    pub active_request_id: Arc<Mutex<Option<String>>>,
    pub active_session_id: Arc<Mutex<Option<String>>>,
    pub active_working_dir: Arc<Mutex<Option<String>>>,
}

async fn create_new_session_impl(
    working_dir: String,
    state: &AiState,
) -> Result<String, String> {
    log::info!("[ai] create_new_session called: workspace={}", working_dir);
    ensure_workspace_exists(&working_dir)?;
    ensure_global_ai_resources_ready()?;

    let settings = ai_config::load_config()
        .map_err(|e| format!("Failed to load AI settings: {}", e))?;

    let active_provider = settings
        .get_active_provider()
        .cloned()
        .ok_or("No active provider configured".to_string())?;

    let system_prompt_constraints = build_session_system_prompt(std::path::Path::new(&working_dir))?;
    let included_sources = system_prompt_constraints.included_sources().to_vec();
    let system_prompt = system_prompt_constraints.into_system_prompt();
    log_system_prompt("create_new_session", &working_dir, &included_sources, &system_prompt);

    let session_id = format!("session-{}", uuid::Uuid::new_v4());
    let timestamp = chrono::Utc::now().timestamp();
    let storage = storage_for_workspace(&working_dir)?;
    storage.create_session(CreateSessionInput {
        id: session_id.clone(),
        title: "新会话".to_string(),
        created_at: timestamp,
        updated_at: timestamp,
        provider_id: Some(active_provider.id.clone()),
        model: active_provider.model.clone(),
        system_prompt: Some(system_prompt.clone()),
    })?;

    let session = ClaurstSession::new(
        session_id.clone(),
        std::path::PathBuf::from(&working_dir),
        active_provider.api_key,
        active_provider.model,
        active_provider.base_url,
        Some(system_prompt),
        Vec::new(),
    ).map_err(|e| format!("Failed to create AI session: {}", e))?;

    set_active_runtime_session(state, session, session_id.clone(), working_dir.clone()).await;
    log::info!(
        "[ai] create_new_session completed: workspace={}, session_id={}",
        working_dir,
        session_id
    );

    Ok(session_id)
}

async fn activate_ai_session_impl(
    session_id: String,
    working_dir: String,
    state: &AiState,
) -> Result<(), String> {
    log::info!(
        "[ai] activate_ai_session called: workspace={}, session_id={}",
        working_dir,
        session_id
    );
    let session = build_runtime_session(&working_dir, &session_id).await?;
    set_active_runtime_session(state, session, session_id.clone(), working_dir.clone()).await;
    log::info!(
        "[ai] activate_ai_session completed: workspace={}, session_id={}",
        working_dir,
        session_id
    );
    Ok(())
}

async fn clear_ai_session_impl(
    working_dir: String,
    session_id: String,
    state: &AiState,
) -> Result<(), String> {
    log::info!(
        "[ai] clear_ai_session called: workspace={}, session_id={}",
        working_dir,
        session_id
    );
    let storage = storage_for_workspace(&working_dir)?;
    storage.clear_session_messages(&session_id)?;

    let active_session_id = state.active_session_id.lock().await.clone();
    let active_working_dir = state.active_working_dir.lock().await.clone();
    if active_session_id.as_deref() == Some(session_id.as_str())
        && active_working_dir.as_deref() == Some(working_dir.as_str())
    {
        let session = build_runtime_session(&working_dir, &session_id).await?;
        set_active_runtime_session(state, session, session_id.clone(), working_dir.clone()).await;
    }

    log::info!(
        "[ai] clear_ai_session completed: workspace={}, session_id={}",
        working_dir,
        session_id
    );
    Ok(())
}

async fn delete_ai_session_impl(
    working_dir: String,
    session_id: String,
    state: &AiState,
) -> Result<(), String> {
    log::info!(
        "[ai] delete_ai_session called: workspace={}, session_id={}",
        working_dir,
        session_id
    );
    let storage = storage_for_workspace(&working_dir)?;
    storage.delete_session(&session_id)?;

    let active_session_id = state.active_session_id.lock().await.clone();
    let active_working_dir = state.active_working_dir.lock().await.clone();
    if active_session_id.as_deref() == Some(session_id.as_str())
        && active_working_dir.as_deref() == Some(working_dir.as_str())
    {
        reset_runtime_state(state).await;
    }

    log::info!(
        "[ai] delete_ai_session completed: workspace={}, session_id={}",
        working_dir,
        session_id
    );
    Ok(())
}

#[tauri::command]
pub async fn init_ai_session(
    working_dir: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    create_new_session(working_dir, state).await
}

#[tauri::command]
pub async fn send_ai_message(
    message: String,
    working_dir: String,
    state: State<'_, AiState>,
    window: Window,
) -> Result<serde_json::Value, String> {
    let active_working_dir = state.active_working_dir.lock().await.clone();
    let active_session_id = state.active_session_id.lock().await.clone();
    let session_present = state.session.lock().await.is_some();
    let request_in_flight = state.active_request_id.lock().await.is_some();
    log::info!(
        "[ai] send_ai_message called: message_len={}, session_present={}, active_session_id={:?}, active_working_dir={:?}",
        message.chars().count(),
        session_present,
        active_session_id,
        active_working_dir
    );

    if !session_present || active_session_id.is_none() {
        log::error!("[ai] send_ai_message rejected: no active session");
        return Err("No active AI session. Please create or reload a session before sending a message.".to_string());
    }

    if request_in_flight {
        return Err("Another AI request is already in progress".to_string());
    }

    if active_working_dir.as_deref() != Some(working_dir.as_str()) {
        log::error!(
            "[ai] send_ai_message rejected: active workspace mismatch; active={:?}, requested={}",
            active_working_dir,
            working_dir
        );
        reset_runtime_state(&state).await;
        return Err("Active AI session does not belong to the current workspace. Please reload or create a session in this workspace.".to_string());
    }

    let cancel_token = CancellationToken::new();
    let request_id = uuid::Uuid::new_v4().to_string();

    *state.cancel_token.lock().await = Some(cancel_token.clone());
    *state.active_request_id.lock().await = Some(request_id.clone());

    log::info!("[ai] send_ai_message prepared request_id={}", request_id);

    let request_id_clone = request_id.clone();
    let session_arc = state.session.clone();
    let cancel_token_arc = state.cancel_token.clone();
    let active_request_id_arc = state.active_request_id.clone();

    tokio::spawn(async move {
        log::info!("[ai] send_ai_message task started: request_id={}", request_id_clone);
        tokio::task::yield_now().await;

        let mut session_guard = session_arc.lock().await;
        if let Some(session) = session_guard.as_mut() {
            log::info!("[ai] send_ai_message entering session.send_message: request_id={}", request_id_clone);
            let result = session.send_message(&message, &request_id_clone, window, cancel_token.clone()).await;
            match result {
                Ok(_) => {
                    log::info!("[ai] send_ai_message session.send_message completed: request_id={}", request_id_clone);
                }
                Err(error) => {
                    log::error!("[ai] send_ai_message session.send_message failed: request_id={}, error={}", request_id_clone, error);
                }
            }
        } else {
            log::error!("[ai] send_ai_message aborted: no active session for request_id={}", request_id_clone);
        }

        *cancel_token_arc.lock().await = None;
        *active_request_id_arc.lock().await = None;
        log::info!("[ai] send_ai_message task finished: request_id={}", request_id_clone);
    });

    log::info!("[ai] send_ai_message returning request_id={}", request_id);
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
    working_dir: String,
    session_id: String,
    state: State<'_, AiState>,
) -> Result<(), String> {
    clear_ai_session_impl(working_dir, session_id, state.inner()).await
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
pub async fn list_ai_sessions(working_dir: String) -> Result<Vec<SessionMetadata>, String> {
    log::info!("[ai] list_ai_sessions called: workspace={}", working_dir);
    let storage = storage_for_workspace(&working_dir)?;
    let sessions = storage.list_sessions()?;
    log::info!(
        "[ai] list_ai_sessions completed: workspace={}, count={}",
        working_dir,
        sessions.len()
    );
    Ok(sessions)
}

#[tauri::command]
pub async fn get_session_metadata(
    working_dir: String,
    session_id: String,
) -> Result<SessionMetadata, String> {
    let storage = storage_for_workspace(&working_dir)?;
    storage.get_session_metadata(&session_id)
}

#[tauri::command]
pub async fn load_ai_session(
    working_dir: String,
    session_id: String,
) -> Result<LoadedSession, String> {
    log::info!(
        "[ai] load_ai_session called: workspace={}, session_id={}",
        working_dir,
        session_id
    );
    let storage = storage_for_workspace(&working_dir)?;
    let loaded = storage.load_session(&session_id)?;
    log::info!(
        "[ai] load_ai_session completed: workspace={}, session_id={}, message_count={}",
        working_dir,
        session_id,
        loaded.messages.len()
    );
    Ok(loaded)
}

#[tauri::command]
pub async fn activate_ai_session(
    session_id: String,
    working_dir: String,
    state: State<'_, AiState>,
) -> Result<(), String> {
    activate_ai_session_impl(session_id, working_dir, state.inner()).await
}

#[tauri::command]
pub async fn delete_ai_session(
    working_dir: String,
    session_id: String,
    state: State<'_, AiState>,
) -> Result<(), String> {
    delete_ai_session_impl(working_dir, session_id, state.inner()).await
}

#[tauri::command]
pub async fn create_new_session(
    working_dir: String,
    state: State<'_, AiState>,
) -> Result<String, String> {
    create_new_session_impl(working_dir, state.inner()).await
}

#[cfg(test)]
mod tests {
    use super::{
        activate_ai_session_impl, build_session_system_prompt, clear_ai_session_impl,
        create_new_session_impl, delete_ai_session_impl, resolve_provider, reset_runtime_state,
        AiState,
    };
    use crate::services::ai_config::{self, AiSettings, ProviderConfig};
    use crate::services::ai_storage::AiStorage;
    use crate::services::test_home_guard::home_test_lock;
    use crate::task_database::TaskDatabase;
    use std::fs;
    use std::sync::Arc;
    use tokio::sync::Mutex;
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

        let db_path = workspace_tweetpilot.join("tweetpilot.db");
        TaskDatabase::new(db_path).expect("initialize workspace database schema");

        let result = test(workspace_dir.clone());

        if let Some(home) = previous_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }

        let _ = fs::remove_dir_all(&temp_root);
        result
    }

    fn create_test_state() -> AiState {
        AiState {
            session: Arc::new(Mutex::new(None)),
            cancel_token: Arc::new(Mutex::new(None)),
            active_request_id: Arc::new(Mutex::new(None)),
            active_session_id: Arc::new(Mutex::new(None)),
            active_working_dir: Arc::new(Mutex::new(None)),
        }
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
    fn resolve_provider_returns_error_for_missing_persisted_provider() {
        let settings = AiSettings {
            active_provider: "provider-2".to_string(),
            providers: vec![ProviderConfig {
                id: "provider-2".to_string(),
                name: "Provider 2".to_string(),
                api_key: "key-2".to_string(),
                base_url: None,
                model: "claude-sonnet-4-6".to_string(),
                enabled: true,
            }],
        };

        let error = resolve_provider(&settings, Some("provider-1"))
            .expect_err("missing persisted provider should fail");

        assert_eq!(
            error,
            "Configured provider 'provider-1' for this session no longer exists"
        );
    }

    #[tokio::test]
    async fn workspace_scoped_session_lifecycle_persists_and_cascades() {
        let _guard = home_test_lock().lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        let temp_root = std::env::temp_dir().join(format!(
            "tweetpilot-ai-command-tests-workspace-lifecycle-{}",
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
        let db_path = workspace_tweetpilot.join("tweetpilot.db");
        TaskDatabase::new(db_path).expect("initialize workspace database schema");

        let state = create_test_state();
        let working_dir = workspace_dir.to_string_lossy().to_string();

        ai_config::save_config(&AiSettings {
            active_provider: "provider-1".to_string(),
            providers: vec![ProviderConfig {
                id: "provider-1".to_string(),
                name: "Provider 1".to_string(),
                api_key: "test-key".to_string(),
                base_url: None,
                model: "claude-sonnet-4-6".to_string(),
                enabled: true,
            }],
        })
        .expect("save ai config");

        let session_id = create_new_session_impl(working_dir.clone(), &state)
            .await
            .expect("create session");

        let storage = AiStorage::new(&workspace_dir).expect("create ai storage");
        let sessions = storage.list_sessions().expect("list sessions after create");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, session_id);
        assert_eq!(sessions[0].workspace, working_dir);

        let user_message = crate::services::ai_storage::StoredMessage {
            id: Some(format!("user-{}", Uuid::new_v4())),
            role: "user".to_string(),
            content: "hello timeline".to_string(),
            timestamp: 1_710_000_000,
            thinking: None,
            thinking_complete: None,
            tool_calls: None,
            timeline: None,
            status: Some("completed".to_string()),
        };
        storage
            .insert_message(&session_id, &user_message)
            .expect("insert user message");

        let assistant_message_id = format!("assistant-{}", Uuid::new_v4());
        let tool_call_id = format!("{}-tool-call", assistant_message_id);
        storage
            .insert_message(
                &session_id,
                &crate::services::ai_storage::StoredMessage {
                    id: Some(assistant_message_id.clone()),
                    role: "assistant".to_string(),
                    content: String::new(),
                    timestamp: 1_710_000_001,
                    thinking: None,
                    thinking_complete: Some(false),
                    tool_calls: None,
                    timeline: None,
                    status: Some("streaming".to_string()),
                },
            )
            .expect("insert assistant placeholder");
        storage
            .finalize_message(
                &session_id,
                &crate::services::ai_storage::StoredMessage {
                    id: Some(assistant_message_id.clone()),
                    role: "assistant".to_string(),
                    content: "final answer".to_string(),
                    timestamp: 1_710_000_002,
                    thinking: Some("first thoughtsecond thought".to_string()),
                    thinking_complete: Some(true),
                    tool_calls: Some(vec![crate::services::ai_storage::StoredToolCall {
                        id: tool_call_id.clone(),
                        tool: "Read".to_string(),
                        action: "Read file".to_string(),
                        input: Some("src/main.tsx".to_string()),
                        output: Some("file body".to_string()),
                        status: "success".to_string(),
                        duration: Some(0.25),
                        start_time: 1_710_000_001,
                        end_time: Some(1_710_000_002),
                    }]),
                    timeline: Some(vec![
                        crate::services::ai_storage::StoredTimelineItem::Thinking {
                            id: format!("{}-thinking-0", assistant_message_id),
                            content: "first thought".to_string(),
                            sequence: 0,
                            is_complete: Some(true),
                        },
                        crate::services::ai_storage::StoredTimelineItem::Tool {
                            id: format!("{}-tool-1", assistant_message_id),
                            tool_call_id: tool_call_id.clone(),
                            sequence: 1,
                        },
                        crate::services::ai_storage::StoredTimelineItem::Thinking {
                            id: format!("{}-thinking-2", assistant_message_id),
                            content: "second thought".to_string(),
                            sequence: 2,
                            is_complete: Some(true),
                        },
                        crate::services::ai_storage::StoredTimelineItem::Text {
                            id: format!("{}-text-3", assistant_message_id),
                            content: "final answer".to_string(),
                            sequence: 3,
                        },
                    ]),
                    status: Some("completed".to_string()),
                },
            )
            .expect("finalize assistant message");

        let loaded = storage.load_session(&session_id).expect("load persisted session");
        assert_eq!(loaded.session.id, session_id);
        assert_eq!(loaded.session.message_count, 2);
        assert_eq!(loaded.messages.len(), 2);
        assert_eq!(loaded.messages[0].content, "hello timeline");
        assert_eq!(loaded.messages[1].content, "final answer");
        assert_eq!(loaded.messages[1].tool_calls.as_ref().map(|calls| calls.len()), Some(1));
        assert_eq!(loaded.messages[1].timeline.as_ref().map(|items| items.len()), Some(4));

        activate_ai_session_impl(session_id.clone(), working_dir.clone(), &state)
            .await
            .expect("activate session from persisted history");
        assert_eq!(state.active_session_id.lock().await.as_deref(), Some(session_id.as_str()));
        assert_eq!(state.active_working_dir.lock().await.as_deref(), Some(working_dir.as_str()));
        assert!(state.session.lock().await.is_some());

        clear_ai_session_impl(working_dir.clone(), session_id.clone(), &state)
            .await
            .expect("clear session messages");
        let cleared = storage.load_session(&session_id).expect("reload cleared session");
        assert_eq!(cleared.messages.len(), 0);
        assert_eq!(cleared.session.message_count, 0);
        assert!(state.session.lock().await.is_some());

        let delete_user_message = crate::services::ai_storage::StoredMessage {
            id: Some(format!("user-{}", Uuid::new_v4())),
            role: "user".to_string(),
            content: "delete me".to_string(),
            timestamp: 1_710_000_003,
            thinking: None,
            thinking_complete: None,
            tool_calls: None,
            timeline: None,
            status: Some("completed".to_string()),
        };
        storage
            .insert_message(&session_id, &delete_user_message)
            .expect("reinsert message before delete");

        delete_ai_session_impl(working_dir.clone(), session_id.clone(), &state)
            .await
            .expect("delete session");
        assert!(storage.load_session(&session_id).is_err());
        assert!(state.session.lock().await.is_none());
        assert!(state.active_session_id.lock().await.is_none());
        assert!(state.active_working_dir.lock().await.is_none());

        reset_runtime_state(&state).await;

        if let Some(home) = previous_home {
            std::env::set_var("HOME", home);
        } else {
            std::env::remove_var("HOME");
        }

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn resolve_provider_falls_back_to_active_provider_when_session_provider_is_absent() {
        let settings = AiSettings {
            active_provider: "provider-2".to_string(),
            providers: vec![ProviderConfig {
                id: "provider-2".to_string(),
                name: "Provider 2".to_string(),
                api_key: "key-2".to_string(),
                base_url: None,
                model: "claude-sonnet-4-6".to_string(),
                enabled: true,
            }],
        };

        let provider = resolve_provider(&settings, None)
            .expect("active provider should be returned when session provider is absent");

        assert_eq!(provider.id, "provider-2");
    }
}
