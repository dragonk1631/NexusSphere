/// <reference types="@cloudflare/workers-types" />

export async function ensureTables(db: D1Database) {
    // V3 Schema: Normalized Song Management
    await db.batch([
        // 1. Songs Master Table
        db.prepare(`
            CREATE TABLE IF NOT EXISTS songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                artist TEXT DEFAULT 'Unknown',
                category TEXT DEFAULT 'Classic',
                asset_path TEXT UNIQUE NOT NULL,
                difficulty INTEGER DEFAULT 5,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `),
        // 2. V3 Records (Referencing songs.id)
        db.prepare(`
            CREATE TABLE IF NOT EXISTS user_song_records_v3 (
                user_id TEXT NOT NULL,
                song_id INTEGER NOT NULL,
                key_mode INTEGER DEFAULT 4,
                difficulty TEXT DEFAULT 'NORMAL',
                score INTEGER DEFAULT 0,
                max_streak INTEGER DEFAULT 0,
                play_count INTEGER DEFAULT 1,
                accuracy REAL DEFAULT 0,
                last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, song_id, key_mode, difficulty),
                FOREIGN KEY (song_id) REFERENCES songs(id)
            )
        `),
        // 3. Keep other tables for compatibility
        db.prepare(`CREATE TABLE IF NOT EXISTS user_stats_v2 (
            user_id TEXT PRIMARY KEY, display_name TEXT, avatar_url TEXT,
            level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0, total_score INTEGER DEFAULT 0,
            play_count INTEGER DEFAULT 0, total_coins INTEGER DEFAULT 0,
            max_combo INTEGER DEFAULT 0, max_streak INTEGER DEFAULT 0,
            total_notes_hit INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)
    ]);

    // --- ROBUST V3 MIGRATION ---
    try {
        const tableInfo = await db.prepare("PRAGMA table_info(user_song_records_v3)").all();
        const cols = tableInfo.results?.map((c: any) => c.name) || [];
        
        if (cols.length > 0 && !cols.includes('key_mode')) {
            console.log('[DB] Migration: Old schema detected. Upgrading...');
            // Step-by-step migration to avoid batch locking issues
            await db.prepare("ALTER TABLE user_song_records_v3 RENAME TO user_song_records_v3_temp").run();
            await db.prepare(`
                CREATE TABLE user_song_records_v3 (
                    user_id TEXT NOT NULL,
                    song_id INTEGER NOT NULL,
                    key_mode INTEGER DEFAULT 4,
                    difficulty TEXT DEFAULT 'NORMAL',
                    score INTEGER DEFAULT 0,
                    max_streak INTEGER DEFAULT 0,
                    play_count INTEGER DEFAULT 1,
                    accuracy REAL DEFAULT 0,
                    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, song_id, key_mode, difficulty),
                    FOREIGN KEY (song_id) REFERENCES songs(id)
                )
            `).run();
            await db.prepare(`
                INSERT OR IGNORE INTO user_song_records_v3 (user_id, song_id, score, max_streak, play_count, accuracy, last_played_at)
                SELECT user_id, song_id, score, max_streak, play_count, accuracy, last_played_at FROM user_song_records_v3_temp
            `).run();
            await db.prepare("DROP TABLE user_song_records_v3_temp").run();
            console.log('[DB] Migration: Complete.');
        }
    } catch (migrationError) {
        console.error('[DB] Migration critical failure:', migrationError);
    }
}
