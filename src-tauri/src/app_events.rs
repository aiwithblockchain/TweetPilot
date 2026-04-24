use chrono::Utc;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const TASK_CREATED: &str = "task-created";
pub const TASK_UPDATED: &str = "task-updated";
pub const TASK_DELETED: &str = "task-deleted";
pub const TASK_PAUSED: &str = "task-paused";
pub const TASK_RESUMED: &str = "task-resumed";
pub const TASK_EXECUTED: &str = "task-executed";
pub const ACCOUNTS_CHANGED: &str = "accounts-changed";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskChangedPayload {
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskExecutedPayload {
    pub task_id: String,
    pub status: String,
    pub finished_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsChangedPayload {
    pub finished_at: String,
}

pub fn publish<M: Serialize + Clone>(app: &AppHandle, message_id: &str, payload: M) {
    if let Err(error) = app.emit(message_id, payload) {
        log::warn!("[app_events] Failed to publish {}: {}", message_id, error);
    }
}

pub fn publish_task_created(app: &AppHandle, task_id: impl Into<String>) {
    publish(app, TASK_CREATED, TaskChangedPayload {
        task_id: task_id.into(),
    });
}

pub fn publish_task_updated(app: &AppHandle, task_id: impl Into<String>) {
    publish(app, TASK_UPDATED, TaskChangedPayload {
        task_id: task_id.into(),
    });
}

pub fn publish_task_deleted(app: &AppHandle, task_id: impl Into<String>) {
    publish(app, TASK_DELETED, TaskChangedPayload {
        task_id: task_id.into(),
    });
}

pub fn publish_task_paused(app: &AppHandle, task_id: impl Into<String>) {
    publish(app, TASK_PAUSED, TaskChangedPayload {
        task_id: task_id.into(),
    });
}

pub fn publish_task_resumed(app: &AppHandle, task_id: impl Into<String>) {
    publish(app, TASK_RESUMED, TaskChangedPayload {
        task_id: task_id.into(),
    });
}

pub fn publish_task_executed(app: &AppHandle, task_id: impl Into<String>, status: impl Into<String>) {
    publish(app, TASK_EXECUTED, TaskExecutedPayload {
        task_id: task_id.into(),
        status: status.into(),
        finished_at: Utc::now().to_rfc3339(),
    });
}

pub fn publish_accounts_changed(app: &AppHandle) {
    publish(app, ACCOUNTS_CHANGED, AccountsChangedPayload {
        finished_at: Utc::now().to_rfc3339(),
    });
}
