-- NexusSphere D1 Seed Data (Global Ranking Mockup)
-- This will populate the production DB with realistic testing data for the Ranking System.

-- 1. Create a variety of global players
INSERT OR IGNORE INTO user_song_records_v2 (user_id, song_id, score, max_streak, play_count, last_played_at) VALUES 
('DJ_Master', 'assets/audio/midi/터키행진곡.mid', 98500, 450, 42, '2026-05-01T10:00:00Z'),
('RhythmKing', 'assets/audio/midi/터키행진곡.mid', 95200, 410, 35, '2026-05-01T11:00:00Z'),
('TechnoFlow', 'assets/audio/generated_midi/After_the_Last_Hit.mid', 88400, 320, 28, '2026-05-01T12:00:00Z'),
('CyberBeat', 'assets/audio/generated_midi/Before_The_Game_Starts.mid', 91000, 380, 50, '2026-05-01T13:00:00Z'),
('NeonDancer', 'assets/audio/midi/corazonazul_ff6boss.mid', 82000, 290, 15, '2026-05-01T14:00:00Z'),
('SilentStriker', 'assets/audio/generated_midi/정상을_향해_더_높이.mid', 99800, 500, 12, '2026-05-01T15:00:00Z'),
('PhantomNote', 'assets/audio/generated_midi/옥빛_바다_무도회.mid', 76000, 210, 5, '2026-05-01T16:00:00Z'),
('AzureCloud', 'assets/audio/midi/터키행진곡.mid', 84000, 300, 20, '2026-05-01T17:00:00Z'),
('CrimsonEdge', 'assets/audio/generated_midi/After_the_Last_Hit.mid', 93000, 400, 18, '2026-05-01T18:00:00Z'),
('GoldNova', 'assets/audio/midi/에어울프.mid', 89000, 350, 30, '2026-05-01T19:00:00Z');

-- 2. Add more entries to make song popularity varied
INSERT OR IGNORE INTO user_song_records_v2 (user_id, song_id, score, max_streak, play_count, last_played_at) VALUES 
('dragonk1379', 'assets/audio/midi/터키행진곡.mid', 92000, 400, 25, '2026-05-02T01:00:00Z'),
('dragonk1379', 'assets/audio/generated_midi/After_the_Last_Hit.mid', 85000, 310, 12, '2026-05-02T02:00:00Z'),
('Guest_Player_1', 'assets/audio/midi/터키행진곡.mid', 70000, 200, 3, '2026-05-02T03:00:00Z'),
('Guest_Player_2', 'assets/audio/midi/에어울프.mid', 65000, 150, 10, '2026-05-02T04:00:00Z'),
('ProGamer99', 'assets/audio/generated_midi/정상을_향해_더_높이.mid', 100000, 520, 60, '2026-05-02T05:00:00Z'),
('BeatMaker', 'assets/audio/generated_midi/정상을_향해_더_높이.mid', 87000, 340, 45, '2026-05-02T06:00:00Z');

-- 3. Some more tracks to fill the list
INSERT OR IGNORE INTO user_song_records_v2 (user_id, song_id, score, max_streak, play_count, last_played_at) VALUES 
('LegacyUser', 'assets/audio/midi/백조의호수.mid', 78000, 250, 8, '2026-05-02T07:00:00Z'),
('Rookie_01', 'assets/audio/generated_midi/너의 의미.mid', 45000, 100, 2, '2026-05-02T08:00:00Z'),
('SpeedRunner', 'assets/audio/midi/corazonazul_ff6boss.mid', 94000, 420, 55, '2026-05-02T09:00:00Z');
