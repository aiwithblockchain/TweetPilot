use tweetpilot::unified_timer::*;
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
