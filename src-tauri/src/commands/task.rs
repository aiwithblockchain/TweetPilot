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
    #[serde(rename = "type")]
    pub task_type: TaskType,
    pub status: TaskStatus,
    #[serde(rename = "scriptPath")]
    pub script_path: String,
    pub schedule: Option<String>,
    pub parameters: Option<HashMap<String, String>>,
    #[serde(rename = "nextExecutionTime")]
    pub next_execution_time: Option<String>,
    #[serde(rename = "lastExecutionTime")]
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
    #[serde(rename = "startTime")]
    pub start_time: String,
    #[serde(rename = "endTime")]
    pub end_time: String,
    pub status: String,
    pub output: String,
    pub error: Option<String>,
    pub duration: f32,
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
    // Mock implementation with fake data

    // Generate fake execution history
    let mut execution_history = vec![];
    for i in 0..5 {
        let start = chrono::Utc::now() - chrono::Duration::hours(i as i64 * 2);
        let success = i % 3 != 0; // 2 out of 3 succeed

        execution_history.push(ExecutionResult {
            start_time: start.to_rfc3339(),
            end_time: (start + chrono::Duration::seconds(2)).to_rfc3339(),
            status: if success { "success".to_string() } else { "failure".to_string() },
            output: if success {
                "Task completed successfully\nProcessed 50 items".to_string()
            } else {
                "Task started\nProcessing...".to_string()
            },
            error: if success {
                None
            } else {
                Some("Connection timeout".to_string())
            },
            duration: 2.1 + (i as f32 * 0.3),
        });
    }

    // Generate fake failure log (only failed executions)
    let failure_log: Vec<ExecutionResult> = execution_history
        .iter()
        .filter(|e| e.status == "failure")
        .cloned()
        .collect();

    Ok(TaskDetail {
        task: Task {
            id: _task_id.clone(),
            name: "测试任务".to_string(),
            description: Some("这是一个测试任务".to_string()),
            task_type: TaskType::Immediate,
            status: TaskStatus::Idle,
            script_path: "/path/to/script.py".to_string(),
            schedule: None,
            parameters: Some({
                let mut params = HashMap::new();
                params.insert("name".to_string(), "value".to_string());
                params.insert("count".to_string(), "100".to_string());
                params
            }),
            next_execution_time: None,
            last_execution_time: Some(chrono::Utc::now().to_rfc3339()),
        },
        statistics: TaskStatistics {
            total_executions: 15,
            success_count: 12,
            failure_count: 3,
            success_rate: 80.0,
            average_duration: 2.5,
        },
        history: execution_history,
        failure_log,
    })
}
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
    // Mock implementation with delay to simulate execution
    let start = chrono::Utc::now();
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    let end = chrono::Utc::now();

    // Randomly generate success or failure for testing
    let success = rand::random::<bool>();

    if success {
        Ok(ExecutionResult {
            start_time: start.to_rfc3339(),
            end_time: end.to_rfc3339(),
            status: "success".to_string(),
            output: "Task executed successfully!\n\nProcessing data...\nCompleted 100 items\nAll operations finished.".to_string(),
            error: None,
            duration: 2.15,
        })
    } else {
        Ok(ExecutionResult {
            start_time: start.to_rfc3339(),
            end_time: end.to_rfc3339(),
            status: "failure".to_string(),
            output: "Task started...\nProcessing data...".to_string(),
            error: Some("Error: Connection timeout after 30 seconds\nFailed to connect to remote server".to_string()),
            duration: 1.85,
        })
    }
}

#[tauri::command]
pub async fn get_execution_history(_task_id: String, _limit: Option<usize>) -> Result<Vec<ExecutionRecord>, String> {
    // TODO: 获取执行历史
    Ok(vec![])
}
