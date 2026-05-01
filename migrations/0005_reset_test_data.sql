-- Migration 0005: Reset Dirty Test Data
-- Clear all stats and records to start fresh as requested by the user.

DELETE FROM user_stats_v2;
DELETE FROM user_rank_stats;
DELETE FROM user_song_records_v2;
DELETE FROM user_scores;
