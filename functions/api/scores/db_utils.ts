/// <reference types="@cloudflare/workers-types" />

export async function ensureTables(db: D1Database) {
    if (!db) return;

    // D1의 batch 기능을 사용하여 한 번에 여러 테이블 생성 시도
    await db.batch([
        db.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                avatar_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `),
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                song_id TEXT NOT NULL,
                score INTEGER NOT NULL,
                accuracy REAL NOT NULL,
                max_combo INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `),
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_scores_song_score ON user_scores(song_id, score DESC)
        `),
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_scores_user ON user_scores(user_id)
        `)
    ]);
}
