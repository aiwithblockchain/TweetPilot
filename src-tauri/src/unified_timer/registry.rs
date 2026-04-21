use crate::unified_timer::types::Timer;
use std::collections::{BinaryHeap, HashMap};

pub struct TimerRegistry {
    timers: HashMap<String, Timer>,
    queue: BinaryHeap<Timer>,
}

impl TimerRegistry {
    pub fn new() -> Self {
        Self {
            timers: HashMap::new(),
            queue: BinaryHeap::new(),
        }
    }

    pub fn register(&mut self, mut timer: Timer) -> Result<(), String> {
        log::info!("[Registry] Registering timer: {} ({})", timer.id, timer.name);

        if self.timers.contains_key(&timer.id) {
            log::error!("[Registry] Timer {} already exists", timer.id);
            return Err(format!("Timer with id {} already exists", timer.id));
        }

        if timer.next_execution.is_none() {
            let now = chrono::Utc::now();
            timer.next_execution = timer.calculate_next_execution(now);
            log::debug!("[Registry] Calculated next_execution for timer {}: {:?}", timer.id, timer.next_execution);
        }

        self.timers.insert(timer.id.clone(), timer.clone());
        self.queue.push(timer.clone());

        log::info!("[Registry] Timer {} registered successfully. Queue size: {}", timer.id, self.queue.len());

        Ok(())
    }

    pub fn unregister(&mut self, timer_id: &str) -> Result<(), String> {
        if !self.timers.contains_key(timer_id) {
            return Err(format!("Timer with id {} not found", timer_id));
        }

        self.timers.remove(timer_id);
        self.rebuild_queue();

        Ok(())
    }

    pub fn pop_next(&mut self) -> Option<Timer> {
        let timer = self.queue.pop();
        if let Some(ref t) = timer {
            log::debug!("[Registry] Popped timer from queue: {} ({}). Remaining: {}",
                t.id, t.name, self.queue.len());
        } else {
            log::debug!("[Registry] Queue is empty");
        }
        timer
    }

    pub fn update_timer(&mut self, timer: Timer) {
        log::debug!("[Registry] Updating timer: {} ({})", timer.id, timer.name);

        let should_rebuild = if let Some(old_timer) = self.timers.get(&timer.id) {
            old_timer.next_execution != timer.next_execution ||
            old_timer.enabled != timer.enabled
        } else {
            true
        };

        self.timers.insert(timer.id.clone(), timer.clone());

        if should_rebuild {
            log::debug!("[Registry] Rebuilding queue for timer {}", timer.id);
            self.rebuild_queue();
            log::debug!("[Registry] Queue rebuilt. New size: {}", self.queue.len());
        }
    }

    pub fn list_all(&self) -> Vec<Timer> {
        self.timers.values().cloned().collect()
    }

    fn rebuild_queue(&mut self) {
        self.queue.clear();
        for timer in self.timers.values() {
            if timer.enabled && timer.next_execution.is_some() {
                self.queue.push(timer.clone());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::unified_timer::types::TimerType;

    #[test]
    fn test_register_timer() {
        let mut registry = TimerRegistry::new();

        let timer = Timer {
            id: "test-1".to_string(),
            name: "Test Timer".to_string(),
            timer_type: TimerType::Interval { seconds: 60 },
            enabled: true,
            priority: 0,
            next_execution: None,
            last_execution: None,
            executor: "dummy".to_string(),
            executor_config: serde_json::json!({}),
        };

        assert!(registry.register(timer).is_ok());
        assert!(registry.get("test-1").is_some());
    }

    #[test]
    fn test_duplicate_registration() {
        let mut registry = TimerRegistry::new();

        let timer = Timer {
            id: "test-1".to_string(),
            name: "Test Timer".to_string(),
            timer_type: TimerType::Interval { seconds: 60 },
            enabled: true,
            priority: 0,
            next_execution: None,
            last_execution: None,
            executor: "dummy".to_string(),
            executor_config: serde_json::json!({}),
        };

        assert!(registry.register(timer.clone()).is_ok());
        assert!(registry.register(timer).is_err());
    }

    #[test]
    fn test_unregister_timer() {
        let mut registry = TimerRegistry::new();

        let timer = Timer {
            id: "test-1".to_string(),
            name: "Test Timer".to_string(),
            timer_type: TimerType::Interval { seconds: 60 },
            enabled: true,
            priority: 0,
            next_execution: None,
            last_execution: None,
            executor: "dummy".to_string(),
            executor_config: serde_json::json!({}),
        };

        registry.register(timer).unwrap();
        assert!(registry.unregister("test-1").is_ok());
        assert!(registry.get("test-1").is_none());
    }
}
