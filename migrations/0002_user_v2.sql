-- User Persistent Records & Stats v2
-- Migration to support per-difficulty/mode high scores and XP system

CREATE TABLE IF NOT EXISTS user_stats_v2 (
    user_id TEXT PRIMARY KEY,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    total_play_time INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    total_notes_hit INTEGER DEFAULT 0,
    max_combo INTEGER DEFAULT 0,
    avg_accuracy REAL DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_song_records_v2 (
    user_id TEXT,
    song_id TEXT,
    key_mode INTEGER, -- 4 or 6
    difficulty TEXT, -- EZ, NM, HD, EX
    high_score INTEGER DEFAULT 0,
    max_combo INTEGER DEFAULT 0,
    best_accuracy REAL DEFAULT 0,
    best_grade TEXT DEFAULT 'F',
    play_count INTEGER DEFAULT 0,
    clear_count INTEGER DEFAULT 0,
    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id, key_mode, difficulty)
);

CREATE INDEX IF NOT EXISTS idx_user_song_records_user ON user_song_records_v2(user_id);
