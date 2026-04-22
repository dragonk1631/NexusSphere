-- User Favorites Synchronization v2
CREATE TABLE IF NOT EXISTS user_favorites_v2 (
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites_v2(user_id);
