CREATE TABLE IF NOT EXISTS ai_message_timeline_items (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    type TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    content TEXT,
    tool_call_id TEXT,
    is_complete INTEGER,
    FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (tool_call_id) REFERENCES ai_tool_calls(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_message_timeline_items_message_sequence
    ON ai_message_timeline_items(message_id, sequence, id);
