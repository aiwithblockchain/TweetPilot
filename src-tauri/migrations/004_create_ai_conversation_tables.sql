CREATE TABLE IF NOT EXISTS ai_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    provider_id TEXT,
    model TEXT NOT NULL,
    system_prompt TEXT,
    schema_version INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    timestamp INTEGER NOT NULL,
    thinking TEXT,
    thinking_complete INTEGER,
    status TEXT,
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session_timestamp
    ON ai_messages(session_id, timestamp, id);

CREATE TABLE IF NOT EXISTS ai_tool_calls (
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
    FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_message_id
    ON ai_tool_calls(message_id);
