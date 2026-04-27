-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('immediate', 'scheduled')),
  status TEXT NOT NULL CHECK(status IN ('idle', 'running', 'paused', 'completed', 'failed')),
  enabled INTEGER NOT NULL DEFAULT 1,

  execution_mode TEXT NOT NULL DEFAULT 'script' CHECK(execution_mode IN ('script', 'ai_session')),
  use_persona INTEGER NOT NULL DEFAULT 0,
  persona_prompt TEXT,

  script_path TEXT NOT NULL DEFAULT '',
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

  tweet_id TEXT,
  text TEXT,
  last_execution_status TEXT CHECK(last_execution_status IN ('success', 'failure', 'failed')),

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
  run_no INTEGER,
  session_code TEXT,
  task_session_id TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration REAL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'failure', 'failed')),
  exit_code INTEGER,
  stdout TEXT,
  stderr TEXT,
  final_output TEXT,
  error_message TEXT,
  metadata TEXT,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Task AI sessions table
CREATE TABLE IF NOT EXISTS task_ai_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  task_run_id TEXT NOT NULL,
  session_code TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  provider_id TEXT,
  model TEXT NOT NULL,
  system_prompt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  schema_version INTEGER NOT NULL DEFAULT 5,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (task_run_id) REFERENCES executions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_ai_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  timestamp INTEGER NOT NULL,
  thinking TEXT,
  thinking_complete INTEGER,
  status TEXT,
  FOREIGN KEY (session_id) REFERENCES task_ai_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_ai_tool_calls (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  tool TEXT NOT NULL,
  action TEXT NOT NULL,
  input TEXT,
  output TEXT,
  status TEXT NOT NULL,
  duration REAL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  FOREIGN KEY (message_id) REFERENCES task_ai_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_ai_message_timeline_items (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  content TEXT,
  tool_call_id TEXT,
  is_complete INTEGER,
  FOREIGN KEY (message_id) REFERENCES task_ai_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (tool_call_id) REFERENCES task_ai_tool_calls(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_enabled ON tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_tasks_execution_mode ON tasks(execution_mode);
CREATE INDEX IF NOT EXISTS idx_executions_task ON executions(task_id);
CREATE INDEX IF NOT EXISTS idx_executions_time ON executions(start_time);
CREATE INDEX IF NOT EXISTS idx_executions_task_session_id ON executions(task_session_id);
CREATE INDEX IF NOT EXISTS idx_task_ai_sessions_task ON task_ai_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_ai_sessions_run ON task_ai_sessions(task_run_id);
CREATE INDEX IF NOT EXISTS idx_task_ai_messages_session ON task_ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_task_ai_tool_calls_message ON task_ai_tool_calls(message_id);
CREATE INDEX IF NOT EXISTS idx_task_ai_timeline_message ON task_ai_message_timeline_items(message_id);
