-- Managed Twitter Accounts table
CREATE TABLE IF NOT EXISTS managed_twitter_accounts (
    twitter_id TEXT PRIMARY KEY,
    screen_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    description TEXT,
    is_verified BOOLEAN DEFAULT 0,
    is_managed BOOLEAN DEFAULT 0,
    last_online_time TIMESTAMP,
    instance_id TEXT,
    extension_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_last_online
ON managed_twitter_accounts(last_online_time DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_is_managed
ON managed_twitter_accounts(is_managed);
