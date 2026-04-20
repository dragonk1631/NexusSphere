-- Migration 0003: Professional Stats & Achievement Tracking
-- This migration expands the profile and adds per-difficulty/mode rank tracking.

-- 1. Upgrade User Profile with Social & Global Totals
-- SQLite doesn't support multiple ADD COLUMNs in one statement, so we'll do it safely.
ALTER TABLE user_stats_v2 ADD COLUMN display_name TEXT;
ALTER TABLE user_stats_v2 ADD COLUMN avatar_url TEXT;
ALTER TABLE user_stats_v2 ADD COLUMN total_perfect INTEGER DEFAULT 0;
ALTER TABLE user_stats_v2 ADD COLUMN total_great INTEGER DEFAULT 0;
ALTER TABLE user_stats_v2 ADD COLUMN total_good INTEGER DEFAULT 0;
ALTER TABLE user_stats_v2 ADD COLUMN total_miss INTEGER DEFAULT 0;
ALTER TABLE user_stats_v2 ADD COLUMN total_coins INTEGER DEFAULT 0;

-- 2. New Table: Detailed Rank & Achievement Stats
-- Distinguishes counts by [Key Mode] and [Difficulty]
CREATE TABLE IF NOT EXISTS user_rank_stats (
    user_id TEXT,
    key_mode INTEGER, -- 4 or 6
    difficulty TEXT, -- EZ, NM, HD, EX
    rank_s_plus INTEGER DEFAULT 0,
    rank_s INTEGER DEFAULT 0,
    rank_a INTEGER DEFAULT 0,
    rank_b INTEGER DEFAULT 0,
    rank_c INTEGER DEFAULT 0,
    rank_d INTEGER DEFAULT 0,
    rank_f INTEGER DEFAULT 0,
    fc_count INTEGER DEFAULT 0, -- Full Combo count
    ap_count INTEGER DEFAULT 0, -- All Perfect count
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, key_mode, difficulty)
);

CREATE INDEX IF NOT EXISTS idx_user_rank_stats_user ON user_rank_stats(user_id);
