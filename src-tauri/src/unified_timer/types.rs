use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TimerType {
    Interval {
        seconds: u64,
    },
    Cron {
        expression: String,
    },
    OneTime {
        execute_at: DateTime<Utc>,
    },
    Dependency {
        after_task: String,
        delay_seconds: Option<u64>,
    },
}

#[derive(Debug, Clone)]
pub struct Timer {
    pub id: String,
    pub name: String,
    pub timer_type: TimerType,
    pub enabled: bool,
    pub priority: u8,
    pub next_execution: Option<DateTime<Utc>>,
    pub last_execution: Option<DateTime<Utc>>,
    pub executor: String,
    pub executor_config: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct ExecutionContext {
    pub timer_id: String,
    pub timer_name: String,
    pub execution_time: DateTime<Utc>,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub timer_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub duration: f64,
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub enum RetryPolicy {
    None,
    Fixed {
        max_attempts: u32,
        delay_seconds: u64,
    },
    Exponential {
        max_attempts: u32,
        initial_delay_seconds: u64,
        max_delay_seconds: u64,
    },
}

impl Timer {
    pub fn calculate_next_execution(&self, from: DateTime<Utc>) -> Option<DateTime<Utc>> {
        match &self.timer_type {
            TimerType::Interval { seconds } => {
                if let Some(last_exec) = self.last_execution {
                    let time_since_last = from.signed_duration_since(last_exec);
                    let interval = chrono::Duration::seconds(*seconds as i64);
                    // 使用 i64 避免溢出，并确保 n >= 0
                    let n = (time_since_last.num_seconds() as f64 / *seconds as f64).floor().max(0.0) as i64;
                    Some(last_exec + interval * (n as i32 + 1))
                } else {
                    Some(from + chrono::Duration::seconds(*seconds as i64))
                }
            }
            TimerType::Cron { expression } => {
                use cron::Schedule;
                use std::str::FromStr;

                if let Ok(schedule) = Schedule::from_str(expression) {
                    schedule.upcoming(Utc).next()
                } else {
                    None
                }
            }
            TimerType::OneTime { execute_at } => {
                if from < *execute_at {
                    Some(*execute_at)
                } else {
                    None
                }
            }
            TimerType::Dependency { .. } => {
                None
            }
        }
    }
}

impl std::cmp::PartialEq for Timer {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl std::cmp::Eq for Timer {}

impl std::cmp::PartialOrd for Timer {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl std::cmp::Ord for Timer {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match (self.next_execution, other.next_execution) {
            (Some(_), Some(_)) => {
                other.next_execution.cmp(&self.next_execution)
                    .then_with(|| self.priority.cmp(&other.priority))
            }
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => self.priority.cmp(&other.priority),
        }
    }
}
