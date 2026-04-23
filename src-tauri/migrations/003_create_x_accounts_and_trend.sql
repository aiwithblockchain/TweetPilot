CREATE TABLE IF NOT EXISTS x_accounts (
    twitter_id TEXT PRIMARY KEY,
    is_managed BOOLEAN NOT NULL DEFAULT 0,
    managed_at TIMESTAMP,
    unmanaged_at TIMESTAMP,
    instance_id TEXT,
    extension_name TEXT,
    personality_prompt TEXT,
    management_level INTEGER DEFAULT 0,
    permission_group TEXT,
    tags TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS x_account_trend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    twitter_id TEXT NOT NULL,
    screen_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    description TEXT,
    is_verified BOOLEAN DEFAULT 0,
    followers_count INTEGER,
    following_count INTEGER,
    tweet_count INTEGER,
    favourites_count INTEGER,
    listed_count INTEGER,
    media_count INTEGER,
    account_created_at TEXT,
    last_online_time TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (twitter_id) REFERENCES x_accounts(twitter_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_x_accounts_is_managed
ON x_accounts(is_managed);

CREATE INDEX IF NOT EXISTS idx_x_accounts_managed_at
ON x_accounts(managed_at DESC);

CREATE INDEX IF NOT EXISTS idx_x_accounts_instance_id
ON x_accounts(instance_id);

CREATE INDEX IF NOT EXISTS idx_x_account_trend_twitter_id
ON x_account_trend(twitter_id);

CREATE INDEX IF NOT EXISTS idx_x_account_trend_created_at
ON x_account_trend(twitter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_x_account_trend_last_online
ON x_account_trend(last_online_time DESC);
