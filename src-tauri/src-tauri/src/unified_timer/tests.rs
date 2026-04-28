#[cfg(test)]
mod tests {
    use super::*;
    use crate::unified_timer::types::{TimerType, Timer};
    use tokio::time::{sleep, Duration};

    #[tokio::test]
    async fn test_basic_timer_registration() {
        let manager = UnifiedTimerManager::new();

        let timer = Timer {
            id: "test-interval-1".to_string(),
            name: "Test Interval Timer".to_string(),
            timer_type: TimerType::Interval { seconds: 5 },
            enabled: true,
            priority: 0,
            next_execution: None,
            last_execution: None,
            executor: "dummy".to_string(),
            executor_config: serde_json::json!({}),
        };

        let result = manager.register_timer(timer).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_timer_execution() {
        let manager = UnifiedTimerManager::new();

        let now = chrono::Utc::now();
        let execute_at = now + chrono::Duration::seconds(2);

        let timer = Timer {
            id: "test-onetime-1".to_string(),
            name: "Test OneTime Timer".to_string(),
            timer_type: TimerType::OneTime { execute_at },
            enabled: true,
            priority: 0,
            next_execution: Some(execute_at),
            last_execution: None,
            executor: "dummy".to_string(),
            executor_config: serde_json::json!({}),
        };

        manager.register_timer(timer).await.unwrap();
        manager.start().await;

        sleep(Duration::from_secs(3)).await;

        manager.stop().await;
    }

    #[tokio::test]
    async fn test_multiple_timers_priority() {
        let manager = UnifiedTimerManager::new();

        let now = chrono::Utc::now();

        let timer1 = Timer {
            id: "test-priority-1".to_string(),
            name: "Low Priority Timer".to_string(),
            timer_type: TimerType::OneTime {
                execute_at: now + chrono::Duration::seconds(5)
            },
            enabled: true,
            priority: 100,
            next_execution: Some(now + chrono::Duration::seconds(5)),
            last_execution: None,
            executor: "dummy".to_string(),
            executor_config: serde_json::json!({}),
        };

        let timer2 = Timer {
            id: "test-priority-2".to_string(),
            name: "High Priority Timer".to_string(),
            timer_type: TimerType::OneTime {
                execute_at: now + chrono::Duration::seconds(5)
            },
            enabled: true,
            priority: 10,
            next_execution: Some(now + chrono::Duration::seconds(5)),
            last_execution: None,
            executor: "dummy".to_string(),
            executor_config: serde_json::json!({}),
        };

        manager.register_timer(timer1).await.unwrap();
        manager.register_timer(timer2).await.unwrap();

        let registry = manager.registry.lock().await;
        let next = registry.peek_next();
        assert!(next.is_some());
        assert_eq!(next.unwrap().priority, 10);
    }
}
