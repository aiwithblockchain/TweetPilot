use claurst_core::{Config, PermissionMode, Message, MessageContent, ContentBlock, CostTracker};
use claurst_query::{QueryConfig, QueryOutcome, QueryEvent, run_query_loop};
use claurst_tools::{
    Tool, ToolContext,
    FileReadTool, FileEditTool, FileWriteTool,
    BashTool, GlobTool, GrepTool,
};
use claurst_api::{AnthropicClient, client::ClientConfig, AnthropicStreamEvent};
use crate::services::conversation_storage::{ConversationStorage, StoredMessage, StoredToolCall};
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

pub struct ClaurstSession {
    session_id: String,
    #[allow(dead_code)]
    working_dir: PathBuf,
    client: AnthropicClient,
    config: QueryConfig,
    messages: Vec<Message>,
    tools: Vec<Box<dyn Tool>>,
    context: ToolContext,
    cost_tracker: Arc<CostTracker>,
    storage: ConversationStorage,
}

impl ClaurstSession {
    pub fn new(
        session_id: String,
        working_dir: PathBuf,
        api_key: String,
        model: String,
        base_url: Option<String>,
    ) -> anyhow::Result<Self> {
        let api_base = base_url.unwrap_or_else(|| "https://api.anthropic.com".to_string());
        log::info!("Initializing Claurst session {} with api_base: {}, model: {}", session_id, api_base, model);

        let client_config = ClientConfig {
            api_key: api_key.clone(),
            api_base,
            request_timeout: Duration::from_secs(120),
            ..Default::default()
        };

        let client = AnthropicClient::new(client_config)?;
        log::info!("AnthropicClient created successfully");

        let mut config = Config::default();
        config.project_dir = Some(working_dir.clone());
        config.permission_mode = PermissionMode::BypassPermissions;
        config.model = Some(model.clone());

        const DEFAULT_THINKING_BUDGET: u32 = 10000;

        let mut query_config = QueryConfig::from_config(&config);
        query_config.model = model;
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
                claurst_core::file_history::FileHistory::new()
            )),
            current_turn: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            non_interactive: false,
            mcp_manager: None,
            config,
            managed_agent_config: None,
            completion_notifier: None,
        };

        let storage = ConversationStorage::new()
            .map_err(|e| anyhow::anyhow!("Failed to create storage: {}", e))?;

        let messages: Vec<Message> = if let Ok(stored_messages) = storage.load_messages(&session_id) {
            stored_messages.into_iter().map(|m| {
                if m.role == "user" {
                    Message::user(m.content)
                } else {
                    Message::assistant(m.content)
                }
            }).collect()
        } else {
            Vec::new()
        };

        Ok(Self {
            session_id,
            working_dir,
            client,
            config: query_config,
            messages,
            tools,
            context,
            cost_tracker: Arc::clone(&cost_tracker),
            storage,
        })
    }

    pub fn get_session_id(&self) -> &str {
        &self.session_id
    }

    pub async fn send_message(
        &mut self,
        message: &str,
        request_id: &str,
        window: Window,
        cancel_token: CancellationToken,
    ) -> anyhow::Result<String> {
        let now = chrono::Utc::now().timestamp();
        self.messages.push(Message::user(message.to_string()));
        log::info!("User message added, total messages: {}", self.messages.len());

        if let Err(e) = self.storage.save_message(
            &self.session_id,
            StoredMessage {
                id: Some(format!("user-{}", now)),
                role: "user".to_string(),
                content: message.to_string(),
                timestamp: now,
                thinking: None,
                thinking_complete: None,
                tool_calls: None,
                status: None,
            },
        ) {
            log::warn!("Failed to save user message to storage: {}", e);
        }

        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
        let event_window = window.clone();
        let request_id_owned = request_id.to_string();
        let thinking_buffer = Arc::new(tokio::sync::Mutex::new(String::new()));
        let tool_calls = Arc::new(tokio::sync::Mutex::new(Vec::<StoredToolCall>::new()));
        let status_text = Arc::new(tokio::sync::Mutex::new(None::<String>));
        let thinking_buffer_for_events = Arc::clone(&thinking_buffer);
        let tool_calls_for_events = Arc::clone(&tool_calls);
        let status_text_for_events = Arc::clone(&status_text);

        tokio::spawn(async move {
            while let Some(event) = event_rx.recv().await {
                match event {
                    QueryEvent::Stream(stream_event) => {
                        use claurst_api::streaming::ContentDelta;
                        if let AnthropicStreamEvent::ContentBlockDelta { delta, .. } = stream_event {
                            match delta {
                                ContentDelta::TextDelta { text } => {
                                    let _ = event_window.emit("message-chunk", serde_json::json!({
                                        "request_id": request_id_owned.clone(),
                                        "chunk": text,
                                    }));
                                }
                                ContentDelta::ThinkingDelta { thinking } => {
                                    thinking_buffer_for_events.lock().await.push_str(&thinking);
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
                        tool_calls_for_events.lock().await.push(StoredToolCall {
                            id: format!("{}-{}", tool_name, timestamp_ms),
                            tool: tool_name.clone(),
                            action: description.clone(),
                            input: None,
                            output: None,
                            status: "running".to_string(),
                            duration: None,
                            start_time: timestamp_ms,
                            end_time: None,
                        });
                        let _ = event_window.emit("tool-call-start", serde_json::json!({
                            "request_id": request_id_owned.clone(),
                            "tool": tool_name,
                            "action": description,
                        }));
                    }
                    QueryEvent::ToolEnd { tool_name, result, is_error, .. } => {
                        let end_time = chrono::Utc::now().timestamp_millis();
                        let mut tool_calls_guard = tool_calls_for_events.lock().await;
                        if let Some(tool_call) = tool_calls_guard.iter_mut().rev().find(|tc| tc.tool == tool_name && tc.status == "running") {
                            tool_call.status = if is_error { "error".to_string() } else { "success".to_string() };
                            tool_call.output = Some(result.clone());
                            tool_call.end_time = Some(end_time);
                            tool_call.duration = Some((end_time - tool_call.start_time) as f64 / 1000.0);
                        }
                        drop(tool_calls_guard);
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
        ).await;

        let final_text = match outcome {
            QueryOutcome::EndTurn { message: msg, .. } => {
                collect_final_text_from_message(&msg)
            }
            QueryOutcome::MaxTokens { partial_message, .. } => {
                collect_final_text_from_message(&partial_message)
            }
            QueryOutcome::Cancelled => {
                let _ = window.emit("ai-request-end", serde_json::json!({
                    "request_id": request_id,
                    "result": "cancelled",
                    "error": "Request cancelled",
                }));
                return Err(anyhow::anyhow!("Request cancelled"));
            }
            QueryOutcome::Error(e) => {
                let error_message = format!("Query error: {}", e);
                let _ = window.emit("ai-request-end", serde_json::json!({
                    "request_id": request_id,
                    "result": "error",
                    "error": error_message,
                }));
                return Err(anyhow::anyhow!(error_message));
            }
            QueryOutcome::BudgetExceeded { .. } => {
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
            if thinking.is_empty() { None } else { Some(thinking) }
        };
        let final_tool_calls = {
            let tool_calls = tool_calls.lock().await.clone();
            if tool_calls.is_empty() { None } else { Some(tool_calls) }
        };
        let final_status = status_text.lock().await.clone().or_else(|| Some("completed".to_string()));

        if let Err(e) = self.storage.save_message(
            &self.session_id,
            StoredMessage {
                id: Some(format!("assistant-{}", final_timestamp)),
                role: "assistant".to_string(),
                content: final_text.clone(),
                timestamp: final_timestamp,
                thinking: final_thinking,
                thinking_complete: Some(true),
                tool_calls: final_tool_calls,
                status: final_status,
            },
        ) {
            log::warn!("Failed to save assistant message to storage: {}", e);
        }

        let _ = window.emit("ai-request-end", serde_json::json!({
            "request_id": request_id,
            "result": "success",
            "final_text": final_text.clone(),
        }));

        Ok(final_text)
    }
}
