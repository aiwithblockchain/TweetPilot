use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskConfig {
    pub name: String,
    pub description: Option<String>,
    pub task_type: TaskType,
    pub script_path: String,
    pub schedule: Option<String>,
    pub parameters: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub task_type: TaskType,
    pub status: TaskStatus,
    pub script_path: String,
    pub schedule: Option<String>,
    pub parameters: Option<HashMap<String, String>>,
    pub next_execution_time: Option<String>,
    pub last_execution_time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDetail {
    pub task: Task,
    pub statistics: TaskStatistics,
    pub history: Vec<ExecutionRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskStatistics {
    pub total_executions: u32,
    pub success_count: u32,
    pub failure_count: u32,
    pub success_rate: f32,
    pub average_duration: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRecord {
    pub id: String,
    pub task_id: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration: Option<f32>,
    pub status: TaskStatus,
    pub output: Option<String>,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskType {
    Scheduled,
    Immediate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Running,
    Paused,
    Completed,
    Failed,
}

#[tauri::command]
pub async fn create_task(config: TaskConfig) -> Result<Task, String> {
    // TODO: 创建任务
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn get_tasks() -> Result<Vec<Task>, String> {
    // TODO: 获取任务列表
    Ok(vec![])
}

#[tauri::command]
pub async fn get_task_detail(task_id: String) -> Result<TaskDetail, String> {
    // TODO: 获取任务详情
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn update_task(task_id: String, config: TaskConfig) -> Result<(), String> {
    // TODO: 更新任务
    Ok(())
}

#[tauri::command]
pub async fn delete_task(task_id: String) -> Result<(), String> {
    // TODO: 删除任务
    Ok(())
}

#[tauri::command]
pub async fn pause_task(task_id: String) -> Result<(), String> {
    // TODO: 暂停任务
    Ok(())
}

#[tauri::command]
pub async fn resume_task(task_id: String) -> Result<(), String> {
    // TODO: 恢复任务
    Ok(())
}

#[tauri::command]
pub async fn execute_task(task_id: String) -> Result<ExecutionResult, String> {
    // TODO: 执行任务
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn get_execution_history(task_id: String, limit: Option<usize>) -> Result<Vec<ExecutionRecord>, String> {
    // TODO: 获取执行历史
    Ok(vec![])
}
