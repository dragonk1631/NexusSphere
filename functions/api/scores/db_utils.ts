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

    // --- AUTOMATIC V3 MIGRATION (Handle legacy table without key_mode/difficulty) ---
    try {
        const check = await db.prepare("PRAGMA table_info(user_song_records_v3)").all();
        const hasKeyMode = check.results?.some((col: any) => col.name === 'key_mode');

        if (!hasKeyMode && check.results?.length > 0) {
            console.log('[DB Migration] Upgrading user_song_records_v3 to support modes and difficulties...');
            await db.batch([
                db.prepare("ALTER TABLE user_song_records_v3 RENAME TO user_song_records_v3_old"),
                db.prepare(`
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
                `),
                db.prepare(`
                    INSERT INTO user_song_records_v3 (user_id, song_id, score, max_streak, play_count, accuracy, last_played_at)
                    SELECT user_id, song_id, score, max_streak, play_count, accuracy, last_played_at FROM user_song_records_v3_old
                `),
                db.prepare("DROP TABLE user_song_records_v3_old")
            ]);
            console.log('[DB Migration] user_song_records_v3 upgrade complete.');
        }
    } catch (e) {
        console.error('[DB Migration] Migration check skipped or failed:', e);
    }
}
