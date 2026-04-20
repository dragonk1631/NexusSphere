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
        `),
        // [v2] Persistent User Stats (Enhanced for Migration 0003)
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_stats_v2 (
                user_id TEXT PRIMARY KEY,
                display_name TEXT,
                avatar_url TEXT,
                level INTEGER DEFAULT 1,
                exp INTEGER DEFAULT 0,
                total_play_time INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0,
                total_notes_hit INTEGER DEFAULT 0,
                total_perfect INTEGER DEFAULT 0,
                total_great INTEGER DEFAULT 0,
                total_good INTEGER DEFAULT 0,
                total_miss INTEGER DEFAULT 0,
                total_coins INTEGER DEFAULT 0,
                max_combo INTEGER DEFAULT 0,
                avg_accuracy REAL DEFAULT 0,
                play_count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `),
        // [v3] Detailed Rank & Achievement Stats
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_rank_stats (
                user_id TEXT,
                key_mode INTEGER,
                difficulty TEXT,
                rank_s_plus INTEGER DEFAULT 0,
                rank_s INTEGER DEFAULT 0,
                rank_a INTEGER DEFAULT 0,
                rank_b INTEGER DEFAULT 0,
                rank_c INTEGER DEFAULT 0,
                rank_d INTEGER DEFAULT 0,
                rank_f INTEGER DEFAULT 0,
                fc_count INTEGER DEFAULT 0,
                ap_count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, key_mode, difficulty)
            )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_rank_stats_user ON user_rank_stats(user_id)`),
        // [v2] Composite Key Song Records
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_song_records_v2 (
                user_id TEXT,
                song_id TEXT,
                key_mode INTEGER,
                difficulty TEXT,
                high_score INTEGER DEFAULT 0,
                max_combo INTEGER DEFAULT 0,
                best_accuracy REAL DEFAULT 0,
                best_grade TEXT DEFAULT 'F',
                play_count INTEGER DEFAULT 0,
                clear_count INTEGER DEFAULT 0,
                last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, song_id, key_mode, difficulty)
            )
        `),
        db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_user_song_records_user ON user_song_records_v2(user_id)
        `)
    ]);

    // Handle ALTER TABLE for existing users (Migration 0003 safety)
    // We try adding columns one by one; failures are ignored if column exists.
    const columns = [
        'display_name TEXT', 'avatar_url TEXT', 
        'total_perfect INTEGER DEFAULT 0', 'total_great INTEGER DEFAULT 0', 
        'total_good INTEGER DEFAULT 0', 'total_miss INTEGER DEFAULT 0', 
        'total_coins INTEGER DEFAULT 0'
    ];
    
    for (const col of columns) {
        try {
            await db.prepare(`ALTER TABLE user_stats_v2 ADD COLUMN ${col}`).run();
        } catch (e) {
            // Likely already exists
        }
    }
}
