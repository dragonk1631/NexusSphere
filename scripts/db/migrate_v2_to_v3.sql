-- NexusSphere V2 to V3 Data Migration
-- Transfers old play records into the new normalized schema

INSERT OR IGNORE INTO user_song_records_v3 (
    user_id, song_id, score, max_streak, play_count, accuracy, last_played_at
)
SELECT 
    v2.user_id, 
    s.id as song_id, 
    v2.high_score as score, 
    v2.max_combo as max_streak, 
    v2.play_count, 
    v2.best_accuracy as accuracy, 
    v2.last_played_at
FROM user_song_records_v2 v2
JOIN songs s ON v2.song_id = s.asset_path;
