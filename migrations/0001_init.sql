-- 유저 테이블 (기본 프로필)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- Clerk User ID
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 점수 기록 테이블
CREATE TABLE IF NOT EXISTS user_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    max_combo INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 인덱스 설정 (빠른 리더보드 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_scores_song_score ON user_scores(song_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_user ON user_scores(user_id);
