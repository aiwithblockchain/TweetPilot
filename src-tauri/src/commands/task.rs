use crate::services::storage;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const TASKS_FILE: &str = "tasks.json";
const TASK_DETAILS_FILE: &str = "task-details.json";
const TASK_HISTORY_FILE: &str = "task-history.json";

fn default_tasks() -> Vec<Task> {
    let now = chrono::Utc::now();
    let one_hour_ago = now - chrono::Duration::hours(1);
    let two_hours_ago = now - chrono::Duration::hours(2);
    let next_hour = now + chrono::Duration::hours(1);

    vec![
        Task {
            id: "task_1".to_string(),
            name: "测试即时任务".to_string(),
            description: Some("这是一个测试任务".to_string()),
            task_type: TaskType::Immediate,
            status: TaskStatus::Idle,
            script_path: "/path/to/script.py".to_string(),
            schedule: None,
            parameters: Some(HashMap::from([
                ("topic".to_string(), "ai".to_string()),
                ("tone".to_string(), "friendly".to_string()),
            ])),
            next_execution_time: None,
            last_execution_time: Some(one_hour_ago.to_rfc3339()),
            last_execution_status: Some("success".to_string()),
            last_execution: Some(ExecutionResult {
                start_time: two_hours_ago.to_rfc3339(),
                end_time: one_hour_ago.to_rfc3339(),
                status: "success".to_string(),
                output: "Task completed successfully\nProcessed 50 items".to_string(),
                error: None,
                duration: 2.1,
            }),
            statistics: None,
        },
        Task {
            id: "task_2".to_string(),
            name: "测试定时任务".to_string(),
            description: Some("每小时执行一次".to_string()),
            task_type: TaskType::Scheduled,
            status: TaskStatus::Running,
            script_path: "/path/to/scheduled.py".to_string(),
            schedule: Some("0 * * * *".to_string()),
            parameters: Some(HashMap::from([("region".to_string(), "global".to_string())])),
            next_execution_time: Some(next_hour.to_rfc3339()),
            last_execution_time: Some(one_hour_ago.to_rfc3339()),
            last_execution_status: None,
            last_execution: None,
            statistics: Some(TaskStatistics {
                total_executions: 15,
                success_count: 12,
                failure_count: 3,
                success_rate: 80.0,
                average_duration: 2.5,
            }),
        },
    ]
}

fn default_task_details() -> HashMap<String, TaskDetail> {
    let tasks = default_tasks();
    let now = chrono::Utc::now();
    let one_hour_ago = now - chrono::Duration::hours(1);
    let two_hours_ago = now - chrono::Duration::hours(2);

    HashMap::from([
        (
            "task_1".to_string(),
            TaskDetail {
                task: tasks[0].clone(),
                statistics: TaskStatistics {
                    total_executions: 6,
                    success_count: 5,
                    failure_count: 1,
                    success_rate: 83.3,
                    average_duration: 2.2,
                },
                history: vec![ExecutionResult {
                    start_time: two_hours_ago.to_rfc3339(),
                    end_time: one_hour_ago.to_rfc3339(),
                    status: "success".to_string(),
                    output: "Task completed successfully\nProcessed 50 items".to_string(),
                    error: None,
                    duration: 2.1,
                }],
                failure_log: vec![ExecutionResult {
                    start_time: (now - chrono::Duration::hours(26)).to_rfc3339(),
                    end_time: (now - chrono::Duration::hours(26)
                        + chrono::Duration::milliseconds(1800))
                    .to_rfc3339(),
                    status: "failure".to_string(),
                    output: "Task started\nProcessing...".to_string(),
                    error: Some("Connection timeout".to_string()),
                    duration: 1.8,
                }],
            },
        ),
        (
            "task_2".to_string(),
            TaskDetail {
                task: tasks[1].clone(),
                statistics: TaskStatistics {
                    total_executions: 15,
                    success_count: 12,
                    failure_count: 3,
                    success_rate: 80.0,
                    average_duration: 2.5,
                },
                history: vec![ExecutionResult {
                    start_time: two_hours_ago.to_rfc3339(),
                    end_time: one_hour_ago.to_rfc3339(),
                    status: "success".to_string(),
                    output: "Scheduled task finished".to_string(),
                    error: None,
                    duration: 2.4,
                }],
                failure_log: vec![ExecutionResult {
                    start_time: (now - chrono::Duration::hours(8)).to_rfc3339(),
                    end_time: (now - chrono::Duration::hours(8)
                        + chrono::Duration::milliseconds(2100))
                    .to_rfc3339(),
                    status: "failure".to_string(),
                    output: "Task started...".to_string(),
                    error: Some("Failed to connect to remote server".to_string()),
                    duration: 2.1,
                }],
            },
        ),
    ])
}

fn default_task_history() -> HashMap<String, Vec<ExecutionRecord>> {
    let now = chrono::Utc::now();
    let one_hour_ago = now - chrono::Duration::hours(1);
    let two_hours_ago = now - chrono::Duration::hours(2);

    HashMap::from([
        (
            "task_1".to_string(),
            vec![ExecutionRecord {
                id: "exec_1".to_string(),
                task_id: "task_1".to_string(),
                start_time: two_hours_ago.to_rfc3339(),
                end_time: Some(one_hour_ago.to_rfc3339()),
                duration: Some(2.1),
                status: TaskStatus::Completed,
                output: Some("Task completed successfully".to_string()),
                exit_code: Some(0),
            }],
        ),
        (
            "task_2".to_string(),
            vec![ExecutionRecord {
                id: "exec_2".to_string(),
                task_id: "task_2".to_string(),
                start_time: two_hours_ago.to_rfc3339(),
                end_time: Some(one_hour_ago.to_rfc3339()),
                duration: Some(2.4),
                status: TaskStatus::Completed,
                output: Some("Scheduled task finished".to_string()),
                exit_code: Some(0),
            }],
        ),
    ])
}

// Global task storage (loaded from disk on first access)
use once_cell::sync::Lazy;
use std::sync::Mutex;

static TASKS: Lazy<Mutex<Vec<Task>>> = Lazy::new(|| {
    Mutex::new(load_tasks().unwrap_or_else(|_| default_tasks()))
});

static TASK_DETAILS: Lazy<Mutex<HashMap<String, TaskDetail>>> = Lazy::new(|| {
    Mutex::new(load_task_details().unwrap_or_else(|_| default_task_details()))
});

static TASK_HISTORY: Lazy<Mutex<HashMap<String, Vec<ExecutionRecord>>>> = Lazy::new(|| {
    Mutex::new(load_task_history().unwrap_or_else(|_| default_task_history()))
});

fn persist_tasks() -> Result<(), String> {
    let tasks = TASKS.lock().unwrap();
    save_tasks(&tasks)
}

fn persist_task_details() -> Result<(), String> {
    let details = TASK_DETAILS.lock().unwrap();
    save_task_details(&details)
}

fn persist_task_history() -> Result<(), String> {
    let history = TASK_HISTORY.lock().unwrap();
    save_task_history(&history)
}

fn load_tasks() -> Result<Vec<Task>, String> {
    storage::read_json(TASKS_FILE, default_tasks())
}

fn save_tasks(tasks: &[Task]) -> Result<(), String> {
    storage::write_json(TASKS_FILE, &tasks.to_vec())
}

fn load_task_details() -> Result<HashMap<String, TaskDetail>, String> {
    storage::read_json(TASK_DETAILS_FILE, default_task_details())
}

fn save_task_details(details: &HashMap<String, TaskDetail>) -> Result<(), String> {
    storage::write_json(TASK_DETAILS_FILE, details)
}

fn load_task_history() -> Result<HashMap<String, Vec<ExecutionRecord>>, String> {
    storage::read_json(TASK_HISTORY_FILE, default_task_history())
}

fn save_task_history(history: &HashMap<String, Vec<ExecutionRecord>>) -> Result<(), String> {
    storage::write_json(TASK_HISTORY_FILE, history)
}

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
    #[serde(rename = "lastExecutionStatus")]
    pub last_execution_status: Option<String>,
    #[serde(rename = "lastExecution")]
    pub last_execution: Option<ExecutionResult>,
    pub statistics: Option<TaskStatistics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDetail {
    pub task: Task,
    pub statistics: TaskStatistics,
    pub history: Vec<ExecutionResult>,
    #[serde(rename = "failureLog")]
    pub failure_log: Vec<ExecutionResult>,
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

fn default_statistics() -> TaskStatistics {
    TaskStatistics {
        total_executions: 0,
        success_count: 0,
        failure_count: 0,
        success_rate: 0.0,
        average_duration: 0.0,
    }
}

fn get_task_or_error(tasks: &[Task], task_id: &str) -> Result<Task, String> {
    tasks.iter()
        .find(|task| task.id == task_id)
        .cloned()
        .ok_or_else(|| "任务不存在".to_string())
}

fn upsert_task_detail(task: Task) {
    let mut details = TASK_DETAILS.lock().unwrap();
    let existing = details.get(&task.id).cloned();

    details.insert(
        task.id.clone(),
        TaskDetail {
            task,
            statistics: existing
                .as_ref()
                .map(|detail| detail.statistics.clone())
                .unwrap_or_else(default_statistics),
            history: existing
                .as_ref()
                .map(|detail| detail.history.clone())
                .unwrap_or_default(),
            failure_log: existing
                .as_ref()
                .map(|detail| detail.failure_log.clone())
                .unwrap_or_default(),
        },
    );
}

fn execution_status_to_task_status(status: &str) -> TaskStatus {
    if status == "success" {
        TaskStatus::Completed
    } else {
        TaskStatus::Failed
    }
}

fn recompute_task_statistics(task_id: &str) -> Result<(), String> {
    let mut details = TASK_DETAILS.lock().unwrap();
    let detail = details
        .get(task_id)
        .cloned()
        .ok_or_else(|| "任务不存在".to_string())?;

    let total_executions = detail.history.len() as u32;
    let success_count = detail
        .history
        .iter()
        .filter(|item| item.status == "success")
        .count() as u32;
    let failure_count = total_executions.saturating_sub(success_count);
    let success_rate = if total_executions == 0 {
        0.0
    } else {
        ((success_count as f32 / total_executions as f32) * 1000.0).round() / 10.0
    };
    let average_duration = if total_executions == 0 {
        0.0
    } else {
        let total_duration: f32 = detail.history.iter().map(|item| item.duration).sum();
        ((total_duration / total_executions as f32) * 100.0).round() / 100.0
    };

    let statistics = TaskStatistics {
        total_executions,
        success_count,
        failure_count,
        success_rate,
        average_duration,
    };
    let failure_log: Vec<ExecutionResult> = detail
        .history
        .iter()
        .filter(|item| item.status == "failure")
        .cloned()
        .collect();

    let mut next_detail = detail;
    next_detail.statistics = statistics.clone();
    next_detail.failure_log = failure_log;
    details.insert(task_id.to_string(), next_detail.clone());
    drop(details);

    let mut tasks = TASKS.lock().unwrap();
    if let Some(task) = tasks.iter_mut().find(|item| item.id == task_id) {
        task.statistics = if matches!(task.task_type, TaskType::Scheduled) {
            Some(statistics.clone())
        } else {
            task.statistics.clone()
        };
        next_detail.task = task.clone();
    }
    drop(tasks);

    let mut details = TASK_DETAILS.lock().unwrap();
    details.insert(task_id.to_string(), next_detail);
    Ok(())
}

fn next_execution_time(task_type: &TaskType, status: &TaskStatus) -> Option<String> {
    if matches!(task_type, TaskType::Scheduled) && matches!(status, TaskStatus::Running) {
        Some((chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339())
    } else {
        None
    }
}

#[tauri::command]
pub async fn create_task(config: TaskConfig) -> Result<Task, String> {
    let task_id = format!("task_{}", chrono::Utc::now().timestamp_millis());

    let task_type = config.task_type.clone();
    let status = match task_type {
        TaskType::Immediate => TaskStatus::Idle,
        TaskType::Scheduled => TaskStatus::Paused,
    };

    let new_task = Task {
        id: task_id,
        name: config.name.trim().to_string(),
        description: config.description.and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }),
        task_type: task_type.clone(),
        status: status.clone(),
        script_path: config.script_path,
        schedule: if matches!(task_type, TaskType::Scheduled) {
            config.schedule
        } else {
            None
        },
        parameters: config.parameters,
        next_execution_time: next_execution_time(&task_type, &status),
        last_execution_time: None,
        last_execution_status: None,
        last_execution: None,
        statistics: if matches!(task_type, TaskType::Scheduled) {
            Some(default_statistics())
        } else {
            None
        },
    };

    let mut tasks = TASKS.lock().unwrap();
    tasks.push(new_task.clone());
    drop(tasks);

    upsert_task_detail(new_task.clone());
    persist_tasks()?;

    Ok(new_task)
}

#[tauri::command]
pub async fn get_tasks() -> Result<Vec<Task>, String> {
    let tasks = TASKS.lock().unwrap();
    Ok(tasks.clone())
}

#[tauri::command]
pub async fn get_task_detail(task_id: String) -> Result<TaskDetail, String> {
    let details = TASK_DETAILS.lock().unwrap();
    details
        .get(&task_id)
        .cloned()
        .ok_or_else(|| "任务不存在".to_string())
}

#[tauri::command]
pub async fn update_task(task_id: String, config: TaskConfig) -> Result<(), String> {
    let mut tasks = TASKS.lock().unwrap();
    let task = tasks
        .iter_mut()
        .find(|item| item.id == task_id)
        .ok_or_else(|| "任务不存在".to_string())?;

    task.name = config.name.trim().to_string();
    task.description = config.description.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    task.task_type = config.task_type;
    task.script_path = config.script_path;
    task.schedule = if matches!(task.task_type, TaskType::Scheduled) {
        config.schedule
    } else {
        None
    };
    task.parameters = config.parameters;
    task.next_execution_time = next_execution_time(&task.task_type, &task.status);
    if matches!(task.task_type, TaskType::Scheduled) && task.statistics.is_none() {
        task.statistics = Some(default_statistics());
    }
    if matches!(task.task_type, TaskType::Immediate) {
        task.statistics = None;
    }

    let updated_task = task.clone();
    drop(tasks);

    upsert_task_detail(updated_task);
    recompute_task_statistics(&task_id)
}

#[tauri::command]
pub async fn delete_task(task_id: String) -> Result<(), String> {
    let mut tasks = TASKS.lock().unwrap();
    let original_len = tasks.len();
    tasks.retain(|t| t.id != task_id);
    if tasks.len() == original_len {
        return Err("任务不存在".to_string());
    }
    drop(tasks);

    TASK_DETAILS.lock().unwrap().remove(&task_id);
    TASK_HISTORY.lock().unwrap().remove(&task_id);

    persist_tasks()?;
    persist_task_details()?;
    persist_task_history()?;

    Ok(())
}

#[tauri::command]
pub async fn pause_task(task_id: String) -> Result<(), String> {
    let mut tasks = TASKS.lock().unwrap();
    let task = tasks
        .iter_mut()
        .find(|item| item.id == task_id)
        .ok_or_else(|| "任务不存在".to_string())?;

    task.status = TaskStatus::Paused;
    task.next_execution_time = None;
    let updated_task = task.clone();
    drop(tasks);

    upsert_task_detail(updated_task);
    persist_tasks()?;
    Ok(())
}

#[tauri::command]
pub async fn resume_task(task_id: String) -> Result<(), String> {
    let mut tasks = TASKS.lock().unwrap();
    let task = tasks
        .iter_mut()
        .find(|item| item.id == task_id)
        .ok_or_else(|| "任务不存在".to_string())?;

    task.status = TaskStatus::Running;
    task.next_execution_time = next_execution_time(&task.task_type, &task.status);
    let updated_task = task.clone();
    drop(tasks);

    upsert_task_detail(updated_task);
    persist_tasks()?;
    Ok(())
}

#[tauri::command]
pub async fn execute_task(task_id: String) -> Result<ExecutionResult, String> {
    {
        let tasks = TASKS.lock().unwrap();
        get_task_or_error(&tasks, &task_id)?;
    }

    let start = chrono::Utc::now();
    tokio::time::sleep(tokio::time::Duration::from_millis(1200)).await;
    let end = chrono::Utc::now();
    let success = task_id
        .chars()
        .last()
        .and_then(|ch| ch.to_digit(10))
        .map(|digit| digit % 2 == 1)
        .unwrap_or(true);

    let result = if success {
        ExecutionResult {
            start_time: start.to_rfc3339(),
            end_time: end.to_rfc3339(),
            status: "success".to_string(),
            output: "Task executed successfully\nProcessed 100 items".to_string(),
            error: None,
            duration: 1.2,
        }
    } else {
        ExecutionResult {
            start_time: start.to_rfc3339(),
            end_time: end.to_rfc3339(),
            status: "failure".to_string(),
            output: "Task started...\nProcessing data...".to_string(),
            error: Some("Error: Connection timeout after 30 seconds".to_string()),
            duration: 1.2,
        }
    };

    let next_status = execution_status_to_task_status(&result.status);
    let history_record = ExecutionRecord {
        id: format!("exec_{}", chrono::Utc::now().timestamp_millis()),
        task_id: task_id.clone(),
        start_time: result.start_time.clone(),
        end_time: Some(result.end_time.clone()),
        duration: Some(result.duration),
        status: next_status.clone(),
        output: Some(result.output.clone()),
        exit_code: Some(if result.status == "success" { 0 } else { 1 }),
    };

    {
        let mut tasks = TASKS.lock().unwrap();
        let task = tasks
            .iter_mut()
            .find(|item| item.id == task_id)
            .ok_or_else(|| "任务不存在".to_string())?;

        task.status = next_status;
        task.last_execution_time = Some(result.end_time.clone());
        task.last_execution_status = Some(result.status.clone());
        task.last_execution = Some(result.clone());
        task.next_execution_time = next_execution_time(&task.task_type, &task.status);
    }

    {
        let mut details = TASK_DETAILS.lock().unwrap();
        let detail = details
            .get_mut(&task_id)
            .ok_or_else(|| "任务不存在".to_string())?;
        detail.history.insert(0, result.clone());
    }

    {
        let mut history = TASK_HISTORY.lock().unwrap();
        history
            .entry(task_id.clone())
            .or_insert_with(Vec::new)
            .insert(0, history_record);
    }

    {
        let tasks = TASKS.lock().unwrap();
        let updated_task = get_task_or_error(&tasks, &task_id)?;
        drop(tasks);
        upsert_task_detail(updated_task);
    }

    recompute_task_statistics(&task_id)?;
    Ok(result)
}

#[tauri::command]
pub async fn get_execution_history(
    task_id: String,
    limit: Option<usize>,
) -> Result<Vec<ExecutionRecord>, String> {
    {
        let tasks = TASKS.lock().unwrap();
        get_task_or_error(&tasks, &task_id)?;
    }

    let history = TASK_HISTORY.lock().unwrap();
    let records = history.get(&task_id).cloned().unwrap_or_default();

    if let Some(limit) = limit {
        if limit > 0 {
            return Ok(records.into_iter().take(limit).collect());
        }
    }

    Ok(records)
}
