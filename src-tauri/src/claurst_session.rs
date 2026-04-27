use claurst_api::{client::ClientConfig, AnthropicClient, AnthropicStreamEvent};
use claurst_core::{Config, ContentBlock, CostTracker, Message, MessageContent, PermissionMode};
use claurst_query::{run_query_loop, QueryConfig, QueryEvent, QueryOutcome};
use claurst_tools::{BashTool, FileEditTool, FileReadTool, FileWriteTool, GlobTool, GrepTool, Tool, ToolContext};
use crate::services::ai_storage::{AiStorage, StoredMessage, StoredTimelineItem, StoredToolCall};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Window};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

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

fn collect_final_text_from_message(msg: &Message) -> String {
    match &msg.content {
        MessageContent::Text(s) => s.trim().to_string(),
        MessageContent::Blocks(blocks) => collect_final_text_from_blocks(blocks),
    }
}

fn to_runtime_message(message: StoredMessage) -> Option<Message> {
    let content = message.content.trim();
    if content.is_empty() {
        return None;
    }

    match message.role.as_str() {
        "user" => Some(Message::user(content.to_string())),
        "assistant" => Some(Message::assistant(content.to_string())),
        _ => None,
    }
}

fn next_timeline_sequence(timeline: &[StoredTimelineItem]) -> i64 {
    timeline.len() as i64
}

pub struct ClaurstSession {
    session_id: String,
    client: AnthropicClient,
    config: QueryConfig,
    messages: Vec<Message>,
    tools: Vec<Box<dyn Tool>>,
    context: ToolContext,
    cost_tracker: Arc<CostTracker>,
    storage: AiStorage,
}

impl ClaurstSession {
    pub fn new(
        session_id: String,
        working_dir: PathBuf,
        api_key: String,
        model: String,
        base_url: Option<String>,
        system_prompt: Option<String>,
        stored_messages: Vec<StoredMessage>,
    ) -> anyhow::Result<Self> {
        let api_base = base_url.unwrap_or_else(|| "https://api.anthropic.com".to_string());
        log::info!(
            "Initializing Claurst session {} with model: {}",
            session_id,
            model
        );

        let client_config = ClientConfig {
            api_key: api_key.clone(),
            api_base,
            request_timeout: Duration::from_secs(120),
            ..Default::default()
        };

        let client = AnthropicClient::new(client_config)?;

        let mut config = Config::default();
        config.project_dir = Some(working_dir.clone());
        config.permission_mode = PermissionMode::BypassPermissions;
        config.model = Some(model.clone());

        const DEFAULT_THINKING_BUDGET: u32 = 10000;

        let mut query_config = QueryConfig::from_config(&config);
        query_config.model = model;
        query_config.system_prompt = system_prompt;
        query_config.thinking_budget = Some(DEFAULT_THINKING_BUDGET);

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
            working_dir: working_dir.clone(),
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

        let storage = AiStorage::new(&working_dir)
            .map_err(|e| anyhow::anyhow!("Failed to create AI storage: {}", e))?;

        let messages = stored_messages
            .into_iter()
            .filter_map(to_runtime_message)
            .collect();

        Ok(Self {
            session_id,
            client,
            config: query_config,
            messages,
            tools,
            context,
            cost_tracker: Arc::clone(&cost_tracker),
            storage,
        })
    }

    pub async fn send_message(
        &mut self,
        message: &str,
        request_id: &str,
        window: Window,
        cancel_token: CancellationToken,
    ) -> anyhow::Result<String> {
        let user_timestamp = chrono::Utc::now().timestamp();
        let user_message_id = format!("user-{}", request_id);
        let assistant_message_id = format!("assistant-{}", request_id);

        self.messages.push(Message::user(message.to_string()));
        log::info!("User message added, total messages: {}", self.messages.len());

        let user_message = StoredMessage {
            id: Some(user_message_id),
            role: "user".to_string(),
            content: message.to_string(),
            timestamp: user_timestamp,
            thinking: None,
            thinking_complete: None,
            tool_calls: None,
            timeline: None,
            status: None,
        };

        self.storage
            .insert_message(&self.session_id, &user_message)
            .map_err(|e| anyhow::anyhow!(e))?;

        let assistant_placeholder = StoredMessage {
            id: Some(assistant_message_id.clone()),
            role: "assistant".to_string(),
            content: String::new(),
            timestamp: user_timestamp,
            thinking: None,
            thinking_complete: Some(false),
            tool_calls: None,
            timeline: Some(Vec::new()),
            status: Some("thinking".to_string()),
        };

        self.storage
            .insert_message(&self.session_id, &assistant_placeholder)
            .map_err(|e| anyhow::anyhow!(e))?;

        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
        let event_window = window.clone();
        let request_id_owned = request_id.to_string();
        let assistant_message_id_for_events = assistant_message_id.clone();
        let storage_for_events = self.storage.clone();
        let thinking_buffer = Arc::new(tokio::sync::Mutex::new(String::new()));
        let tool_calls = Arc::new(tokio::sync::Mutex::new(Vec::<StoredToolCall>::new()));
        let timeline_items = Arc::new(tokio::sync::Mutex::new(Vec::<StoredTimelineItem>::new()));
        let status_text = Arc::new(tokio::sync::Mutex::new(None::<String>));
        let thinking_buffer_for_events = Arc::clone(&thinking_buffer);
        let tool_calls_for_events = Arc::clone(&tool_calls);
        let timeline_items_for_events = Arc::clone(&timeline_items);
        let status_text_for_events = Arc::clone(&status_text);

        tokio::spawn(async move {
            while let Some(event) = event_rx.recv().await {
                match event {
                    QueryEvent::Stream(stream_event) => {
                        use claurst_api::streaming::ContentDelta;
                        if let AnthropicStreamEvent::ContentBlockDelta { delta, .. } = stream_event {
                            match delta {
                                ContentDelta::TextDelta { text } => {
                                    let _ = storage_for_events.append_message_content(&assistant_message_id_for_events, &text);
                                    let mut timeline_guard = timeline_items_for_events.lock().await;
                                    match timeline_guard.last_mut() {
                                        Some(StoredTimelineItem::Text { content, .. }) => {
                                            content.push_str(&text);
                                        }
                                        _ => {
                                            let sequence = next_timeline_sequence(&timeline_guard);
                                            timeline_guard.push(StoredTimelineItem::Text {
                                                id: format!("{}-text-{}", assistant_message_id_for_events, sequence),
                                                content: text.clone(),
                                                sequence,
                                            });
                                        }
                                    }
                                    let snapshot = timeline_guard.clone();
                                    drop(timeline_guard);
                                    let _ = storage_for_events.replace_timeline_items(&assistant_message_id_for_events, &snapshot);
                                    let _ = event_window.emit("message-chunk", serde_json::json!({
                                        "request_id": request_id_owned.clone(),
                                        "chunk": text,
                                    }));
                                }
                                ContentDelta::ThinkingDelta { thinking } => {
                                    let mut thinking_guard = thinking_buffer_for_events.lock().await;
                                    thinking_guard.push_str(&thinking);
                                    let _ = storage_for_events.update_message_thinking(
                                        &assistant_message_id_for_events,
                                        &thinking_guard,
                                        Some(false),
                                    );
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
                                                content: thinking.clone(),
                                                sequence,
                                                is_complete: Some(false),
                                            });
                                        }
                                    }
                                    let snapshot = timeline_guard.clone();
                                    drop(timeline_guard);
                                    let _ = storage_for_events.replace_timeline_items(&assistant_message_id_for_events, &snapshot);
                                    let _ = event_window.emit("thinking-chunk", serde_json::json!({
                                        "request_id": request_id_owned.clone(),
                                        "chunk": thinking,
                                    }));
                                }
                                _ => {}
                            }
                        }
                    }
                    QueryEvent::ToolStart { tool_name, .. } => {
                        let description = format!("Using {}", tool_name);
                        let timestamp_ms = chrono::Utc::now().timestamp_millis();
                        let tool_call_id = format!("{}-{}", tool_name, timestamp_ms);
                        tool_calls_for_events.lock().await.push(StoredToolCall {
                            id: tool_call_id.clone(),
                            tool: tool_name.clone(),
                            action: description.clone(),
                            input: None,
                            output: None,
                            status: "running".to_string(),
                            duration: None,
                            start_time: timestamp_ms,
                            end_time: None,
                        });
                        let snapshot = tool_calls_for_events.lock().await.clone();
                        let _ = storage_for_events.replace_tool_calls(&assistant_message_id_for_events, &snapshot);

                        let mut timeline_guard = timeline_items_for_events.lock().await;
                        if let Some(StoredTimelineItem::Thinking { is_complete, .. }) = timeline_guard.last_mut() {
                            *is_complete = Some(true);
                        }
                        let sequence = next_timeline_sequence(&timeline_guard);
                        timeline_guard.push(StoredTimelineItem::Tool {
                            id: format!("{}-tool-{}", assistant_message_id_for_events, sequence),
                            tool_call_id: tool_call_id.clone(),
                            sequence,
                        });
                        let timeline_snapshot = timeline_guard.clone();
                        drop(timeline_guard);
                        let _ = storage_for_events.replace_timeline_items(&assistant_message_id_for_events, &timeline_snapshot);
                        let _ = event_window.emit("tool-call-start", serde_json::json!({
                            "request_id": request_id_owned.clone(),
                            "tool": tool_name,
                            "action": description,
                        }));
                    }
                    QueryEvent::ToolEnd { tool_name, result, is_error, .. } => {
                        let end_time = chrono::Utc::now().timestamp_millis();
                        let mut tool_calls_guard = tool_calls_for_events.lock().await;
                        if let Some(tool_call) = tool_calls_guard
                            .iter_mut()
                            .rev()
                            .find(|tc| tc.tool == tool_name && tc.status == "running")
                        {
                            tool_call.status = if is_error {
                                "error".to_string()
                            } else {
                                "success".to_string()
                            };
                            tool_call.output = Some(result.clone());
                            tool_call.end_time = Some(end_time);
                            tool_call.duration = Some((end_time - tool_call.start_time) as f64 / 1000.0);
                        }
                        let snapshot = tool_calls_guard.clone();
                        drop(tool_calls_guard);
                        let _ = storage_for_events.replace_tool_calls(&assistant_message_id_for_events, &snapshot);
                        let _ = event_window.emit("tool-call-end", serde_json::json!({
                            "request_id": request_id_owned.clone(),
                            "tool": tool_name,
                            "success": !is_error,
                            "result": result,
                        }));
                    }
                    QueryEvent::Status(status) => {
                        let phase = if status.to_lowercase().contains("tool") {
                            "tool_running"
                        } else {
                            "thinking"
                        };
                        *status_text_for_events.lock().await = Some(status.clone());
                        let _ = storage_for_events.update_message_status(&assistant_message_id_for_events, Some(&status));
                        let _ = event_window.emit("ai-status", serde_json::json!({
                            "request_id": request_id_owned.clone(),
                            "phase": phase,
                            "text": status,
                        }));
                    }
                    _ => {}
                }
            }
        });

        let outcome = run_query_loop(
            &self.client,
            &mut self.messages,
            &self.tools,
            &self.context,
            &self.config,
            Arc::clone(&self.cost_tracker),
            Some(event_tx),
            cancel_token,
            None,
        )
        .await;

        let partial_text = self
            .storage
            .load_messages(&self.session_id)
            .ok()
            .and_then(|messages| {
                messages
                    .into_iter()
                    .find(|message| message.id.as_deref() == Some(assistant_message_id.as_str()))
                    .map(|message| message.content)
            })
            .unwrap_or_default();

        let final_text = match outcome {
            QueryOutcome::EndTurn { message: msg, .. } => collect_final_text_from_message(&msg),
            QueryOutcome::MaxTokens { partial_message, .. } => collect_final_text_from_message(&partial_message),
            QueryOutcome::Cancelled => {
                let cancelled_message = StoredMessage {
                    id: Some(assistant_message_id.clone()),
                    role: "assistant".to_string(),
                    content: partial_text.clone(),
                    timestamp: chrono::Utc::now().timestamp(),
                    thinking: Some(thinking_buffer.lock().await.clone()).filter(|value| !value.is_empty()),
                    thinking_complete: Some(false),
                    tool_calls: {
                        let calls = tool_calls.lock().await.clone();
                        if calls.is_empty() { None } else { Some(calls) }
                    },
                    timeline: {
                        let timeline = timeline_items.lock().await.clone();
                        if timeline.is_empty() { None } else { Some(timeline) }
                    },
                    status: Some("cancelled".to_string()),
                };
                let _ = self.storage.finalize_message(&self.session_id, &cancelled_message);
                let _ = window.emit("ai-request-end", serde_json::json!({
                    "request_id": request_id,
                    "result": "cancelled",
                    "error": "Request cancelled",
                }));
                return Err(anyhow::anyhow!("Request cancelled"));
            }
            QueryOutcome::Error(e) => {
                let error_message = format!("Query error: {}", e);
                let failed_message = StoredMessage {
                    id: Some(assistant_message_id.clone()),
                    role: "assistant".to_string(),
                    content: String::new(),
                    timestamp: chrono::Utc::now().timestamp(),
                    thinking: Some(thinking_buffer.lock().await.clone()).filter(|value| !value.is_empty()),
                    thinking_complete: Some(false),
                    tool_calls: {
                        let calls = tool_calls.lock().await.clone();
                        if calls.is_empty() { None } else { Some(calls) }
                    },
                    timeline: {
                        let timeline = timeline_items.lock().await.clone();
                        if timeline.is_empty() { None } else { Some(timeline) }
                    },
                    status: Some("error".to_string()),
                };
                let _ = self.storage.finalize_message(&self.session_id, &failed_message);
                let _ = window.emit("ai-request-end", serde_json::json!({
                    "request_id": request_id,
                    "result": "error",
                    "error": error_message,
                }));
                return Err(anyhow::anyhow!(error_message));
            }
            QueryOutcome::BudgetExceeded { .. } => {
                let failed_message = StoredMessage {
                    id: Some(assistant_message_id.clone()),
                    role: "assistant".to_string(),
                    content: String::new(),
                    timestamp: chrono::Utc::now().timestamp(),
                    thinking: Some(thinking_buffer.lock().await.clone()).filter(|value| !value.is_empty()),
                    thinking_complete: Some(false),
                    tool_calls: {
                        let calls = tool_calls.lock().await.clone();
                        if calls.is_empty() { None } else { Some(calls) }
                    },
                    timeline: {
                        let timeline = timeline_items.lock().await.clone();
                        if timeline.is_empty() { None } else { Some(timeline) }
                    },
                    status: Some("error".to_string()),
                };
                let _ = self.storage.finalize_message(&self.session_id, &failed_message);
                let _ = window.emit("ai-request-end", serde_json::json!({
                    "request_id": request_id,
                    "result": "error",
                    "error": "Budget exceeded",
                }));
                return Err(anyhow::anyhow!("Budget exceeded"));
            }
        };

        let final_timestamp = chrono::Utc::now().timestamp();
        let final_thinking = {
            let thinking = thinking_buffer.lock().await.clone();
            if thinking.is_empty() {
                None
            } else {
                Some(thinking)
            }
        };
        let final_tool_calls = {
            let calls = tool_calls.lock().await.clone();
            if calls.is_empty() {
                None
            } else {
                Some(calls)
            }
        };
        let final_timeline = {
            let mut timeline = timeline_items.lock().await.clone();
            if let Some(StoredTimelineItem::Thinking { is_complete, .. }) = timeline.last_mut() {
                *is_complete = Some(true);
            }
            if timeline.is_empty() {
                None
            } else {
                Some(timeline)
            }
        };
        let final_status = status_text
            .lock()
            .await
            .clone()
            .or_else(|| Some("completed".to_string()));

        let final_message = StoredMessage {
            id: Some(assistant_message_id),
            role: "assistant".to_string(),
            content: final_text.clone(),
            timestamp: final_timestamp,
            thinking: final_thinking,
            thinking_complete: Some(true),
            tool_calls: final_tool_calls,
            timeline: final_timeline,
            status: final_status,
        };

        self.storage
            .finalize_message(&self.session_id, &final_message)
            .map_err(|e| anyhow::anyhow!(e))?;

        let _ = window.emit("ai-request-end", serde_json::json!({
            "request_id": request_id,
            "result": "success",
            "final_text": final_text.clone(),
        }));

        Ok(final_text)
    }
}
