-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('immediate', 'scheduled')),
  status TEXT NOT NULL CHECK(status IN ('idle', 'running', 'paused', 'completed', 'failed')),
  enabled INTEGER NOT NULL DEFAULT 1,

  script_path TEXT NOT NULL,
  script_content TEXT,
  script_hash TEXT,

  schedule TEXT,
  schedule_type TEXT DEFAULT 'cron' CHECK(schedule_type IN ('cron', 'interval')),
  interval_seconds INTEGER,
  timeout INTEGER,
  retry_count INTEGER DEFAULT 0,
  retry_delay INTEGER DEFAULT 60,

  account_id TEXT NOT NULL,

  parameters TEXT,

  last_execution_time TEXT,
  next_execution_time TEXT,

  total_executions INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  average_duration REAL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  tags TEXT
);

-- Executions table
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration REAL,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  metadata TEXT,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_executions_task ON executions(task_id);
CREATE INDEX IF NOT EXISTS idx_executions_time ON executions(start_time);
