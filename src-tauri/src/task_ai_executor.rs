use crate::services::ai_config;
use crate::services::resource_installer;
use crate::services::session_constraints;
use crate::services::ai_storage::{StoredMessage, StoredTimelineItem, StoredToolCall};
use crate::task_database::{CreateTaskAiSessionInput, ExecutionResult, Task, TaskAiAccountContext, TaskDatabase};
use claurst_api::{client::ClientConfig, AnthropicClient, AnthropicStreamEvent};
use claurst_core::{Config, ContentBlock, CostTracker, Message, MessageContent, PermissionMode};
use claurst_query::{run_query_loop, QueryConfig, QueryEvent, QueryOutcome};
use claurst_tools::{BashTool, FileEditTool, FileReadTool, FileWriteTool, GlobTool, GrepTool, Tool, ToolContext};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

fn ensure_global_ai_resources_ready() -> Result<(), String> {
    let resource_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    resource_installer::ensure_bundled_home_installed(&resource_dir)
}

fn build_task_system_prompt(working_dir: &Path) -> Result<String, String> {
    let constraints = session_constraints::build_session_constraints(working_dir, None)?;
    Ok(constraints.into_system_prompt())
}

fn has_non_empty_description(task: &Task) -> bool {
    task.description
        .as_ref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

fn has_non_empty_persona(task: &Task) -> bool {
    task.persona_prompt
        .as_ref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
}

fn has_non_empty_parameters(task: &Task) -> bool {
    is_non_empty_json_object(&task.parameters)
}

fn summarize_prompt_for_logs(prompt: &str) -> String {
    const MAX_CHARS: usize = 1200;
    let trimmed = prompt.trim();
    let char_count = trimmed.chars().count();
    if char_count <= MAX_CHARS {
        return trimmed.to_string();
    }

    let preview = trimmed.chars().take(MAX_CHARS).collect::<String>();
    format!("{}\n... [truncated, total_chars={}]", preview, char_count)
}

fn collect_final_text_from_blocks(blocks: &[ContentBlock]) -> String {
    blocks
        .iter()
        .filter_map(|block| match block {
            ContentBlock::Text { text } => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn collect_final_text_from_message(message: &Message) -> String {
    match &message.content {
        MessageContent::Text(text) => text.trim().to_string(),
        MessageContent::Blocks(blocks) => collect_final_text_from_blocks(blocks),
    }
}

fn next_timeline_sequence(timeline: &[StoredTimelineItem]) -> i64 {
    timeline.len() as i64
}

fn is_non_empty_json_object(raw: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()
        .and_then(|value| value.as_object().map(|object| !object.is_empty()))
        .unwrap_or(false)
}

fn pretty_json(raw: &str) -> Option<String> {
    let value = serde_json::from_str::<serde_json::Value>(raw).ok()?;
    serde_json::to_string_pretty(&value).ok()
}

fn push_labeled_section(sections: &mut Vec<String>, label: &str, content: String) {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return;
    }
    sections.push(format!("[{label}]\n{trimmed}"));
}

fn build_task_context_block(task: &Task, run_no: i64) -> String {
    let mut lines = vec![
        format!("Task ID: {}", task.id),
        format!("Task Name: {}", task.name),
        format!("Task Type: {}", task.task_type),
        format!("Execution Mode: {}", task.execution_mode),
        format!("Run No: {}", run_no),
    ];

    if !task.account_id.trim().is_empty() {
        lines.push(format!("Bound Account ID: {}", task.account_id));
    }

    lines.join("\n")
}

fn build_account_context_block(account: &TaskAiAccountContext) -> String {
    let mut lines = vec![format!("Twitter ID: {}", account.twitter_id)];

    if let Some(screen_name) = account.screen_name.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        lines.push(format!("Screen Name: {}", screen_name));
    }
    if let Some(display_name) = account.display_name.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        lines.push(format!("Display Name: {}", display_name));
    }
    if let Some(description) = account.description.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        lines.push(format!("Bio: {}", description));
    }
    if let Some(is_verified) = account.is_verified {
        lines.push(format!("Verified: {}", is_verified));
    }
    if let Some(latest_snapshot_at) = account.latest_snapshot_at.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        lines.push(format!("Latest Snapshot At: {}", latest_snapshot_at));
    }

    lines.join("\n")
}

fn build_task_prompt(task: &Task, run_no: i64, account_context: Option<&TaskAiAccountContext>) -> String {
    let mut sections = Vec::new();

    push_labeled_section(&mut sections, "Task Context", build_task_context_block(task, run_no));

    if let Some(account_context) = account_context {
        push_labeled_section(&mut sections, "Bound Account", build_account_context_block(account_context));
    }

    if !task.account_id.trim().is_empty() && task.use_persona {
        if let Some(persona_prompt) = task.persona_prompt.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
            push_labeled_section(&mut sections, "Persona Prompt", persona_prompt.to_string());
        }
    }

    if is_non_empty_json_object(&task.parameters) {
        if let Some(formatted) = pretty_json(&task.parameters) {
            push_labeled_section(&mut sections, "Task Parameters", formatted);
        }
    }

    if let Some(description) = task.description.as_ref().map(|value| value.trim()).filter(|value| !value.is_empty()) {
        push_labeled_section(&mut sections, "Task Instruction", description.to_string());
    }

    sections.join("\n\n")
}

pub async fn execute_task_ai_session(
    task: &Task,
    workspace_root: &str,
    db: Arc<Mutex<TaskDatabase>>,
) -> Result<ExecutionResult, String> {
    log::info!(
        "[TaskAiExecutor] Starting AI task execution: task_id={}, task_name={}, execution_mode={}, task_type={}, has_account={}, use_persona={}, has_persona_snapshot={}, has_parameters={}, workspace_root={}",
        task.id,
        task.name,
        task.execution_mode,
        task.task_type,
        !task.account_id.trim().is_empty(),
        task.use_persona,
        has_non_empty_persona(task),
        has_non_empty_parameters(task),
        workspace_root,
    );

    if task.description.as_ref().map(|value| value.trim().is_empty()).unwrap_or(true) {
        log::error!("[TaskAiExecutor] Task description is empty, cannot execute AI task: task_id={}", task.id);
        return Err("AI session task description cannot be empty".to_string());
    }

    if !Path::new(workspace_root).exists() {
        log::error!("[TaskAiExecutor] Workspace does not exist for AI task: task_id={}, workspace_root={}", task.id, workspace_root);
        return Err(format!("Workspace does not exist: {}", workspace_root));
    }

    ensure_global_ai_resources_ready()?;

    let settings = ai_config::load_config()
        .map_err(|e| format!("Failed to load AI settings: {}", e))?;
    let provider = settings
        .get_active_provider()
        .cloned()
        .ok_or("No active provider configured".to_string())?;

    log::info!(
        "[TaskAiExecutor] Loaded AI provider for task: task_id={}, provider_id={}, model={}",
        task.id,
        provider.id,
        provider.model,
    );

    let system_prompt = build_task_system_prompt(Path::new(workspace_root))?;
    log::info!(
        "[TaskAiExecutor] Built task system prompt: task_id={}, system_prompt_chars={}",
        task.id,
        system_prompt.chars().count(),
    );

    let account_context = {
        let account_id = task.account_id.trim();
        if account_id.is_empty() {
            None
        } else {
            let db_guard = db.lock().map_err(|e| e.to_string())?;
            db_guard
                .get_task_ai_account_context(account_id)
                .map_err(|e| e.to_string())?
        }
    };

    match account_context.as_ref() {
        Some(account) => {
            log::info!(
                "[TaskAiExecutor] Loaded bound account context: task_id={}, twitter_id={}, has_screen_name={}, has_display_name={}, has_bio={}, has_verified={}, has_latest_snapshot_at={}",
                task.id,
                account.twitter_id,
                account.screen_name.as_ref().map(|value| !value.trim().is_empty()).unwrap_or(false),
                account.display_name.as_ref().map(|value| !value.trim().is_empty()).unwrap_or(false),
                account.description.as_ref().map(|value| !value.trim().is_empty()).unwrap_or(false),
                account.is_verified.is_some(),
                account.latest_snapshot_at.as_ref().map(|value| !value.trim().is_empty()).unwrap_or(false),
            );
        }
        None => {
            log::info!(
                "[TaskAiExecutor] No bound account context loaded: task_id={}, requested_account_id={}",
                task.id,
                task.account_id.trim(),
            );
        }
    }
    let start_time = chrono::Utc::now();
    let start_time_str = start_time.to_rfc3339();
    let start_instant = Instant::now();
    let execution_id = uuid::Uuid::new_v4().to_string();
    let run_no = {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        db_guard.get_next_run_no(&task.id).map_err(|e| e.to_string())?
    };
    let session_id = format!("task-session-{}-run-{}", task.id, run_no);
    let session_code = format!("task-{}-run-{}", &task.id[..task.id.len().min(8)], run_no);
    let prompt = build_task_prompt(task, run_no, account_context.as_ref());
    let timestamp = chrono::Utc::now().timestamp();

    log::info!(
        "[TaskAiExecutor] Built task user prompt: task_id={}, run_no={}, session_id={}, session_code={}, has_description={}, includes_bound_account={}, includes_persona={}, includes_parameters={}, prompt_chars={}\n{}",
        task.id,
        run_no,
        session_id,
        session_code,
        has_non_empty_description(task),
        account_context.is_some(),
        !task.account_id.trim().is_empty() && task.use_persona && has_non_empty_persona(task),
        has_non_empty_parameters(task),
        prompt.chars().count(),
        summarize_prompt_for_logs(&prompt),
    );

    {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        db_guard
            .create_execution_stub(&execution_id, &task.id, Some(run_no), &start_time_str)
            .map_err(|e| e.to_string())?;
        db_guard
            .create_task_ai_session(CreateTaskAiSessionInput {
                id: session_id.clone(),
                task_id: task.id.clone(),
                task_run_id: execution_id.clone(),
                session_code: session_code.clone(),
                title: task.name.clone(),
                source_type: "task_execution".to_string(),
                working_dir: workspace_root.to_string(),
                provider_id: Some(provider.id.clone()),
                model: provider.model.clone(),
                system_prompt: Some(system_prompt.clone()),
                created_at: timestamp,
                updated_at: timestamp,
            })
            .map_err(|e| e.to_string())?;
        db_guard
            .update_execution_session_link(&execution_id, &session_id, &session_code)
            .map_err(|e| e.to_string())?;
    }

    log::info!(
        "[TaskAiExecutor] Persisted execution stub and task session shell: task_id={}, execution_id={}, session_id={}",
        task.id,
        execution_id,
        session_id,
    );

    let client = AnthropicClient::new(ClientConfig {
        api_key: provider.api_key.clone(),
        api_base: provider.base_url.clone().unwrap_or_else(|| "https://api.anthropic.com".to_string()),
        request_timeout: Duration::from_secs(120),
        ..Default::default()
    })
    .map_err(|e| format!("Failed to create AI client: {}", e))?;

    let mut config = Config::default();
    config.project_dir = Some(PathBuf::from(workspace_root));
    config.permission_mode = PermissionMode::BypassPermissions;
    config.model = Some(provider.model.clone());

    let mut query_config = QueryConfig::from_config(&config);
    query_config.model = provider.model.clone();
    query_config.system_prompt = Some(system_prompt);
    query_config.thinking_budget = Some(10000);

    let tools: Vec<Box<dyn Tool>> = vec![
        Box::new(FileReadTool),
        Box::new(FileEditTool),
        Box::new(FileWriteTool),
        Box::new(BashTool),
        Box::new(GlobTool),
        Box::new(GrepTool),
    ];

    let cost_tracker = Arc::new(CostTracker::new());
    let context = ToolContext {
        working_dir: PathBuf::from(workspace_root),
        permission_mode: PermissionMode::BypassPermissions,
        permission_handler: Arc::new(claurst_core::AutoPermissionHandler {
            mode: PermissionMode::BypassPermissions,
        }),
        cost_tracker: Arc::clone(&cost_tracker),
        session_id: uuid::Uuid::new_v4().to_string(),
        file_history: Arc::new(parking_lot::Mutex::new(
            claurst_core::file_history::FileHistory::new(),
        )),
        current_turn: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        non_interactive: false,
        mcp_manager: None,
        config,
        managed_agent_config: None,
        completion_notifier: None,
        pending_permissions: None,
        permission_manager: None,
    };

    let user_message_id = format!("user-{}", execution_id);
    let assistant_message_id = format!("assistant-{}", execution_id);
    let user_timestamp = chrono::Utc::now().timestamp();

    {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        db_guard
            .insert_task_ai_message(
                &session_id,
                &StoredMessage {
                    id: Some(user_message_id),
                    role: "user".to_string(),
                    content: prompt.clone(),
                    timestamp: user_timestamp,
                    thinking: None,
                    thinking_complete: None,
                    tool_calls: None,
                    timeline: None,
                    status: None,
                },
            )
            .map_err(|e| e.to_string())?;

        db_guard
            .insert_task_ai_message(
                &session_id,
                &StoredMessage {
                    id: Some(assistant_message_id.clone()),
                    role: "assistant".to_string(),
                    content: String::new(),
                    timestamp: user_timestamp,
                    thinking: None,
                    thinking_complete: Some(false),
                    tool_calls: None,
                    timeline: Some(Vec::new()),
                    status: Some("thinking".to_string()),
                },
            )
            .map_err(|e| e.to_string())?;
    }

    log::info!(
        "[TaskAiExecutor] Persisted initial task AI messages: task_id={}, session_id={}, user_message_id={}, assistant_message_id={}",
        task.id,
        session_id,
        format!("user-{}", execution_id),
        assistant_message_id,
    );

    let thinking_buffer = Arc::new(tokio::sync::Mutex::new(String::new()));
    let tool_calls = Arc::new(tokio::sync::Mutex::new(Vec::<StoredToolCall>::new()));
    let timeline_items = Arc::new(tokio::sync::Mutex::new(Vec::<StoredTimelineItem>::new()));
    let status_text = Arc::new(tokio::sync::Mutex::new(None::<String>));
    let messages = vec![Message::user(prompt)];
    let cancel_token = CancellationToken::new();
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let db_for_events = Arc::clone(&db);
    let assistant_message_id_for_events = assistant_message_id.clone();
    let session_id_for_events = session_id.clone();
    let thinking_buffer_for_events = Arc::clone(&thinking_buffer);
    let tool_calls_for_events = Arc::clone(&tool_calls);
    let timeline_items_for_events = Arc::clone(&timeline_items);
    let status_text_for_events = Arc::clone(&status_text);

    let event_task = tokio::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                QueryEvent::Stream(stream_event) => {
                    use claurst_api::streaming::ContentDelta;
                    if let AnthropicStreamEvent::ContentBlockDelta { delta, .. } = stream_event {
                        match delta {
                            ContentDelta::TextDelta { text } => {
                                if let Ok(db_guard) = db_for_events.lock() {
                                    let _ = db_guard.append_task_ai_message_content(&assistant_message_id_for_events, &text);
                                }
                                let mut timeline_guard = timeline_items_for_events.lock().await;
                                match timeline_guard.last_mut() {
                                    Some(StoredTimelineItem::Text { content, .. }) => content.push_str(&text),
                                    _ => {
                                        let sequence = next_timeline_sequence(&timeline_guard);
                                        timeline_guard.push(StoredTimelineItem::Text {
                                            id: format!("{}-text-{}", assistant_message_id_for_events, sequence),
                                            content: text,
                                            sequence,
                                        });
                                    }
                                }
                            }
                            ContentDelta::ThinkingDelta { thinking } => {
                                let mut thinking_guard = thinking_buffer_for_events.lock().await;
                                thinking_guard.push_str(&thinking);
                                if let Ok(db_guard) = db_for_events.lock() {
                                    let _ = db_guard.update_task_ai_message_thinking(
                                        &assistant_message_id_for_events,
                                        &thinking_guard,
                                        Some(false),
                                    );
                                }
                                drop(thinking_guard);

                                let mut timeline_guard = timeline_items_for_events.lock().await;
                                match timeline_guard.last_mut() {
                                    Some(StoredTimelineItem::Thinking { content, is_complete, .. }) => {
                                        content.push_str(&thinking);
                                        *is_complete = Some(false);
                                    }
                                    _ => {
                                        let sequence = next_timeline_sequence(&timeline_guard);
                                        timeline_guard.push(StoredTimelineItem::Thinking {
                                            id: format!("{}-thinking-{}", assistant_message_id_for_events, sequence),
                                            content: thinking,
                                            sequence,
                                            is_complete: Some(false),
                                        });
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                QueryEvent::ToolStart { tool_name, .. } => {
                    log::info!(
                        "[TaskAiExecutor] Tool started: session_id={}, assistant_message_id={}, tool_name={}",
                        session_id_for_events,
                        assistant_message_id_for_events,
                        tool_name,
                    );
                    let timestamp_ms = chrono::Utc::now().timestamp_millis();
                    let tool_call_id = format!("{}-{}", tool_name, timestamp_ms);
                    tool_calls_for_events.lock().await.push(StoredToolCall {
                        id: tool_call_id.clone(),
                        tool: tool_name.clone(),
                        action: format!("Using {}", tool_name),
                        input: None,
                        output: None,
                        status: "running".to_string(),
                        duration: None,
                        start_time: timestamp_ms,
                        end_time: None,
                    });

                    let mut timeline_guard = timeline_items_for_events.lock().await;
                    if let Some(StoredTimelineItem::Thinking { is_complete, .. }) = timeline_guard.last_mut() {
                        *is_complete = Some(true);
                    }
                    let sequence = next_timeline_sequence(&timeline_guard);
                    timeline_guard.push(StoredTimelineItem::Tool {
                        id: format!("{}-tool-{}", assistant_message_id_for_events, sequence),
                        tool_call_id,
                        sequence,
                    });
                }
                QueryEvent::ToolEnd { tool_name, result, is_error, .. } => {
                    log::info!(
                        "[TaskAiExecutor] Tool finished: session_id={}, assistant_message_id={}, tool_name={}, is_error={}, output_chars={}",
                        session_id_for_events,
                        assistant_message_id_for_events,
                        tool_name,
                        is_error,
                        result.chars().count(),
                    );
                    let end_time = chrono::Utc::now().timestamp_millis();
                    let mut tool_calls_guard = tool_calls_for_events.lock().await;
                    if let Some(tool_call) = tool_calls_guard
                        .iter_mut()
                        .rev()
                        .find(|call| call.tool == tool_name && call.status == "running")
                    {
                        tool_call.status = if is_error { "error".to_string() } else { "success".to_string() };
                        tool_call.output = Some(result);
                        tool_call.end_time = Some(end_time);
                        tool_call.duration = Some((end_time - tool_call.start_time) as f64 / 1000.0);
                    }
                }
                QueryEvent::Status(status) => {
                    log::info!(
                        "[TaskAiExecutor] Status update: session_id={}, assistant_message_id={}, status={}",
                        session_id_for_events,
                        assistant_message_id_for_events,
                        status,
                    );
                    *status_text_for_events.lock().await = Some(status.clone());
                    if let Ok(db_guard) = db_for_events.lock() {
                        let _ = db_guard.update_task_ai_message_status(&assistant_message_id_for_events, Some(&status));
                    }
                }
                _ => {}
            }
        }

        if let Ok(db_guard) = db_for_events.lock() {
            let _ = db_guard.get_task_ai_session_metadata(&session_id_for_events);
        }
    });

    let mut runtime_messages = messages;
    log::info!(
        "[TaskAiExecutor] Entering AI query loop: task_id={}, execution_id={}, session_id={}, model={}, tool_count={}",
        task.id,
        execution_id,
        session_id,
        provider.model,
        tools.len(),
    );
    let outcome = run_query_loop(
        &client,
        &mut runtime_messages,
        &tools,
        &context,
        &query_config,
        Arc::clone(&cost_tracker),
        Some(event_tx),
        cancel_token,
        None,
    )
    .await;

    let _ = event_task.await;

    log::info!(
        "[TaskAiExecutor] AI query loop finished: task_id={}, execution_id={}, session_id={}",
        task.id,
        execution_id,
        session_id,
    );

    let duration = start_instant.elapsed().as_secs_f64();
    let end_time_str = chrono::Utc::now().to_rfc3339();
    let final_thinking = {
        let value = thinking_buffer.lock().await.clone();
        if value.is_empty() { None } else { Some(value) }
    };
    let final_tool_calls = {
        let value = tool_calls.lock().await.clone();
        if value.is_empty() { None } else { Some(value) }
    };
    let final_timeline = {
        let mut value = timeline_items.lock().await.clone();
        if let Some(StoredTimelineItem::Thinking { is_complete, .. }) = value.last_mut() {
            *is_complete = Some(true);
        }
        if value.is_empty() { None } else { Some(value) }
    };
    let final_status = status_text.lock().await.clone();

    let finalize_message = |content: String, status: Option<String>, thinking_complete: Option<bool>| StoredMessage {
        id: Some(assistant_message_id.clone()),
        role: "assistant".to_string(),
        content,
        timestamp: chrono::Utc::now().timestamp(),
        thinking: final_thinking.clone(),
        thinking_complete,
        tool_calls: final_tool_calls.clone(),
        timeline: final_timeline.clone(),
        status,
    };

    let mut result = match outcome {
        QueryOutcome::EndTurn { message, .. } => {
            let final_text = collect_final_text_from_message(&message);
            log::info!(
                "[TaskAiExecutor] Query completed successfully: task_id={}, execution_id={}, session_id={}, final_output_chars={}",
                task.id,
                execution_id,
                session_id,
                final_text.chars().count(),
            );
            ExecutionResult {
                id: execution_id,
                task_id: task.id.clone(),
                run_no: Some(run_no),
                session_code: Some(session_code),
                task_session_id: Some(session_id.clone()),
                start_time: start_time_str,
                end_time: end_time_str,
                duration,
                status: "success".to_string(),
                exit_code: 0,
                stdout: final_text.clone(),
                stderr: String::new(),
                final_output: Some(final_text.clone()),
                error_message: None,
                metadata: None,
            }
        }
        QueryOutcome::MaxTokens { partial_message, .. } => {
            let final_text = collect_final_text_from_message(&partial_message);
            log::warn!(
                "[TaskAiExecutor] Query stopped at max tokens: task_id={}, execution_id={}, session_id={}, partial_output_chars={}",
                task.id,
                execution_id,
                session_id,
                final_text.chars().count(),
            );
            ExecutionResult {
                id: execution_id,
                task_id: task.id.clone(),
                run_no: Some(run_no),
                session_code: Some(session_code),
                task_session_id: Some(session_id.clone()),
                start_time: start_time_str,
                end_time: end_time_str,
                duration,
                status: "failure".to_string(),
                exit_code: 1,
                stdout: final_text.clone(),
                stderr: "Max tokens reached".to_string(),
                final_output: Some(final_text),
                error_message: Some("Max tokens reached".to_string()),
                metadata: None,
            }
        }
        QueryOutcome::Cancelled => {
            log::warn!(
                "[TaskAiExecutor] Query cancelled: task_id={}, execution_id={}, session_id={}",
                task.id,
                execution_id,
                session_id,
            );
            ExecutionResult {
                id: execution_id,
                task_id: task.id.clone(),
                run_no: Some(run_no),
                session_code: Some(session_code),
                task_session_id: Some(session_id.clone()),
                start_time: start_time_str,
                end_time: end_time_str,
                duration,
                status: "failure".to_string(),
                exit_code: 1,
                stdout: String::new(),
                stderr: "Request cancelled".to_string(),
                final_output: None,
                error_message: Some("Request cancelled".to_string()),
                metadata: None,
            }
        },
        QueryOutcome::BudgetExceeded { .. } => {
            log::warn!(
                "[TaskAiExecutor] Query budget exceeded: task_id={}, execution_id={}, session_id={}",
                task.id,
                execution_id,
                session_id,
            );
            ExecutionResult {
                id: execution_id,
                task_id: task.id.clone(),
                run_no: Some(run_no),
                session_code: Some(session_code),
                task_session_id: Some(session_id.clone()),
                start_time: start_time_str,
                end_time: end_time_str,
                duration,
                status: "failure".to_string(),
                exit_code: 1,
                stdout: String::new(),
                stderr: "Budget exceeded".to_string(),
                final_output: None,
                error_message: Some("Budget exceeded".to_string()),
                metadata: None,
            }
        }
        QueryOutcome::Error(error) => {
            log::error!(
                "[TaskAiExecutor] Query failed: task_id={}, execution_id={}, session_id={}, error={}",
                task.id,
                execution_id,
                session_id,
                error,
            );
            ExecutionResult {
                id: execution_id,
                task_id: task.id.clone(),
                run_no: Some(run_no),
                session_code: Some(session_code),
                task_session_id: Some(session_id.clone()),
                start_time: start_time_str,
                end_time: end_time_str,
                duration,
                status: "failure".to_string(),
                exit_code: 1,
                stdout: String::new(),
                stderr: error.to_string(),
                final_output: None,
                error_message: Some(format!("Query error: {}", error)),
                metadata: None,
            }
        }
    };

    {
        let db_guard = db.lock().map_err(|e| e.to_string())?;
        let message = if result.status == "success" {
            finalize_message(
                result.final_output.clone().unwrap_or_default(),
                final_status.or_else(|| Some("completed".to_string())),
                Some(true),
            )
        } else {
            finalize_message(
                result.final_output.clone().unwrap_or_default(),
                final_status.or_else(|| Some("error".to_string())),
                Some(false),
            )
        };

        db_guard
            .finalize_task_ai_message(&session_id, &message)
            .map_err(|e| e.to_string())?;

        db_guard
            .finalize_execution(&result)
            .map_err(|e| e.to_string())?;
    }

    log::info!(
        "[TaskAiExecutor] Finalized task AI execution: task_id={}, execution_id={}, session_id={}, status={}, duration_secs={:.3}, final_output_chars={}, tool_call_count={}, timeline_item_count={}",
        task.id,
        result.id,
        session_id,
        result.status,
        result.duration,
        result.final_output.as_ref().map(|value| value.chars().count()).unwrap_or(0),
        final_tool_calls.as_ref().map(|value| value.len()).unwrap_or(0),
        final_timeline.as_ref().map(|value| value.len()).unwrap_or(0),
    );

    if result.status != "success" && result.final_output.is_none() {
        result.final_output = None;
    }

    Ok(result)
}
