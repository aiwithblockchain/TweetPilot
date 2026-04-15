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
    Idle,
    Completed,
    Failed,
}

#[tauri::command]
pub async fn create_task(config: TaskConfig) -> Result<Task, String> {
    // TODO: 创建任务
    // Mock implementation
    let task_id = format!("task_{}", chrono::Utc::now().timestamp());

    let status = match config.task_type {
        TaskType::Immediate => TaskStatus::Idle,
        TaskType::Scheduled => TaskStatus::Paused,
    };

    Ok(Task {
        id: task_id,
        name: config.name,
        description: config.description,
        task_type: config.task_type,
        status,
        script_path: config.script_path,
        schedule: config.schedule,
        parameters: config.parameters,
        next_execution_time: None,
        last_execution_time: None,
    })
}

#[tauri::command]
pub async fn get_tasks() -> Result<Vec<Task>, String> {
    // TODO: 获取任务列表
    // Mock data for development
    Ok(vec![
        Task {
            id: "task_1".to_string(),
            name: "测试即时任务".to_string(),
            description: Some("这是一个测试任务".to_string()),
            task_type: TaskType::Immediate,
            status: TaskStatus::Idle,
            script_path: "/path/to/script.py".to_string(),
            schedule: None,
            parameters: None,
            next_execution_time: None,
            last_execution_time: Some(chrono::Utc::now().to_rfc3339()),
        },
        Task {
            id: "task_2".to_string(),
            name: "测试定时任务".to_string(),
            description: Some("每小时执行一次".to_string()),
            task_type: TaskType::Scheduled,
            status: TaskStatus::Running,
            script_path: "/path/to/scheduled.py".to_string(),
            schedule: Some("0 * * * *".to_string()),
            parameters: None,
            next_execution_time: Some(chrono::Utc::now().to_rfc3339()),
            last_execution_time: Some(chrono::Utc::now().to_rfc3339()),
        },
    ])
}

#[tauri::command]
pub async fn get_task_detail(_task_id: String) -> Result<TaskDetail, String> {
    // TODO: 获取任务详情
    // Mock implementation
    Ok(TaskDetail {
        task: Task {
            id: "task_1".to_string(),
            name: "测试任务".to_string(),
            description: Some("这是一个测试任务".to_string()),
            task_type: TaskType::Immediate,
            status: TaskStatus::Idle,
            script_path: "/path/to/script.py".to_string(),
            schedule: None,
            parameters: None,
            next_execution_time: None,
            last_execution_time: None,
        },
        statistics: TaskStatistics {
            total_executions: 10,
            success_count: 8,
            failure_count: 2,
            success_rate: 80.0,
            average_duration: 2.5,
        },
        history: vec![],
    })
}

#[tauri::command]
pub async fn update_task(_task_id: String, _config: TaskConfig) -> Result<(), String> {
    // TODO: 更新任务
    Ok(())
}

#[tauri::command]
pub async fn delete_task(_task_id: String) -> Result<(), String> {
    // TODO: 删除任务
    println!("Deleting task: {}", _task_id);
    Ok(())
}

#[tauri::command]
pub async fn pause_task(_task_id: String) -> Result<(), String> {
    // TODO: 暂停任务
    println!("Pausing task: {}", _task_id);
    Ok(())
}

#[tauri::command]
pub async fn resume_task(_task_id: String) -> Result<(), String> {
    // TODO: 恢复任务
    println!("Resuming task: {}", _task_id);
    Ok(())
}

#[tauri::command]
pub async fn execute_task(_task_id: String) -> Result<ExecutionResult, String> {
    // TODO: 执行任务
    // Mock implementation with delay
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

    Ok(ExecutionResult {
        success: true,
        output: Some("Task executed successfully".to_string()),
        error: None,
    })
}

#[tauri::command]
pub async fn get_execution_history(_task_id: String, _limit: Option<usize>) -> Result<Vec<ExecutionRecord>, String> {
    // TODO: 获取执行历史
    Ok(vec![])
}
