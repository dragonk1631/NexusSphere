-- NexusSphere Database Schema V3 (Normalized)
-- 1. Songs Master Table
CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    artist TEXT DEFAULT 'Unknown',
    category TEXT DEFAULT 'Classic',
    asset_path TEXT UNIQUE NOT NULL,
    difficulty INTEGER DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Song Records V3 (Referencing songs table)
CREATE TABLE IF NOT EXISTS user_song_records_v3 (
    user_id TEXT NOT NULL,
    song_id INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 1,
    accuracy REAL DEFAULT 0,
    last_played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
);

-- 3. Initial Song Registration (Seed Data)
INSERT OR IGNORE INTO songs (slug, title, artist, asset_path, difficulty) VALUES 
('turkish-march', '터키행진곡 (Turkish March)', 'W.A. Mozart', 'assets/audio/midi/터키행진곡.mid', 8),
('after-last-hit', 'After the Last Hit', 'NexusSphere Original', 'assets/audio/generated_midi/After_the_Last_Hit.mid', 6),
('before-game-starts', 'Before The Game Starts', 'NexusSphere Original', 'assets/audio/generated_midi/Before_The_Game_Starts.mid', 4),
('corazonazul', 'Corazonazul (FF6 Boss)', 'Nobuo Uematsu', 'assets/audio/midi/corazonazul_ff6boss.mid', 9),
('reach-higher', '정상을 향해 더 높이', 'NexusSphere Original', 'assets/audio/generated_midi/정상을_향해_더_높이.mid', 7),
('azure-ballroom', '옥빛 바다 무도회', 'NexusSphere Original', 'assets/audio/generated_midi/옥빛_바다_무도회.mid', 5),
('swan-lake', '백조의 호수', 'Tchaikovsky', 'assets/audio/midi/백조의호수.mid', 7),
('air-wolf', '에어울프 (Airwolf)', 'Sylvester Levay', 'assets/audio/midi/에어울프.mid', 8),
('your-meaning', '너의 의미', 'Kim Chang-wan', 'assets/audio/generated_midi/너의 의미.mid', 3);
