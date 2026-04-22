/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from './db_utils';

interface Env {
    DB: D1Database;
}

/**
 * Simple JWT Decorder (Non-verifying for demo/pages context)
 * In production, you would use a library or verify the signature with Clerk Public Key.
 */
function decodeJWT(token: string): any {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    
    try {
        if (!env.DB) throw new Error('D1 Binding [env.DB] is missing');
        await ensureTables(env.DB);

        // 1. Authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return new Response('Unauthorized', { status: 401 });

        const token = authHeader.split(' ')[1];
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.sub) return new Response('Unauthorized', { status: 401 });

        const userId = decoded.sub;
        const body: any = await request.json();
        
        // Destructure all necessary stats for professional tracking
        const { 
            songId, keyMode, difficulty, score, accuracy, maxCombo, 
            gainedXP, gainedCoin, grade, isFC, isAP, 
            perfect, great, good, miss,
            nickname, avatarUrl 
        } = body;

        if (!songId || !keyMode || !difficulty) {
            return new Response('Missing required data', { status: 400 });
        }

        const normalizedGrade = (grade || 'F').toUpperCase().replace('+', '_plus').toLowerCase();
        const rankColumn = `rank_${normalizedGrade}`;

        // 2. Atomic Batch Update
        await env.DB.batch([
            // [A] Update Global Profile & Socials
            env.DB.prepare(`
                INSERT INTO user_stats_v2 (
                    user_id, display_name, avatar_url, 
                    exp, total_score, play_count, 
                    total_perfect, total_great, total_good, total_miss,
                    max_combo, current_streak, max_streak, total_notes_hit, 
                    total_coins, updated_at
                )
                VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    display_name = COALESCE(EXCLUDED.display_name, user_stats_v2.display_name),
                    avatar_url = COALESCE(EXCLUDED.avatar_url, user_stats_v2.avatar_url),
                    exp = user_stats_v2.exp + EXCLUDED.exp,
                    total_score = user_stats_v2.total_score + EXCLUDED.total_score,
                    play_count = user_stats_v2.play_count + 1,
                    total_perfect = user_stats_v2.total_perfect + EXCLUDED.total_perfect,
                    total_great = user_stats_v2.total_great + EXCLUDED.total_great,
                    total_good = user_stats_v2.total_good + EXCLUDED.total_good,
                    total_miss = user_stats_v2.total_miss + EXCLUDED.total_miss,
                    max_combo = MAX(user_stats_v2.max_combo, EXCLUDED.max_combo),
                    current_streak = EXCLUDED.current_streak,
                    max_streak = MAX(user_stats_v2.max_streak, EXCLUDED.current_streak),
                    total_notes_hit = user_stats_v2.total_notes_hit + (EXCLUDED.total_perfect + EXCLUDED.total_great + EXCLUDED.total_good),
                    total_coins = user_stats_v2.total_coins + EXCLUDED.total_coins,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(userId, nickname, avatarUrl, gainedXP, score, perfect || 0, great || 0, good || 0, miss || 0, maxCombo, body.currentCombo || 0, body.currentCombo || 0, (perfect || 0) + (great || 0) + (good || 0), gainedCoin),

            // [B] Update Leveling (Based on total XP threshold: 40 * (L^2 + L))
            env.DB.prepare(`
                UPDATE user_stats_v2 
                SET level = (
                    SELECT MAX(level_calc) FROM (
                        SELECT 1 as level_calc UNION
                        SELECT CAST(( -40 + SQRT(1600 + 160 * exp) ) / 80 + 1 AS INTEGER)
                    )
                )
                WHERE user_id = ?
            `).bind(userId),

            // [C] Update Detailed Rank Stats (Separated by Key and Difficulty)
            env.DB.prepare(`
                INSERT INTO user_rank_stats (
                    user_id, key_mode, difficulty, ${rankColumn}, fc_count, ap_count, updated_at
                )
                VALUES (?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, key_mode, difficulty) DO UPDATE SET
                    ${rankColumn} = user_rank_stats.${rankColumn} + 1,
                    fc_count = user_rank_stats.fc_count + EXCLUDED.fc_count,
                    ap_count = user_rank_stats.ap_count + EXCLUDED.ap_count,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(userId, keyMode, difficulty, isFC ? 1 : 0, isAP ? 1 : 0),

            // [D] Update Song Best Record
            env.DB.prepare(`
                INSERT INTO user_song_records_v2 (
                    user_id, song_id, key_mode, difficulty, 
                    high_score, max_combo, best_accuracy, best_grade, 
                    play_count, clear_count, last_played_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, song_id, key_mode, difficulty) DO UPDATE SET
                    high_score = MAX(user_song_records_v2.high_score, EXCLUDED.high_score),
                    max_combo = MAX(user_song_records_v2.max_combo, EXCLUDED.max_combo),
                    best_accuracy = MAX(user_song_records_v2.best_accuracy, EXCLUDED.best_accuracy),
                    best_grade = CASE 
                        WHEN EXCLUDED.high_score > user_song_records_v2.high_score THEN EXCLUDED.best_grade 
                        ELSE user_song_records_v2.best_grade 
                    END,
                    play_count = user_song_records_v2.play_count + 1,
                    clear_count = user_song_records_v2.clear_count + 1,
                    last_played_at = CURRENT_TIMESTAMP
            `).bind(userId, songId, keyMode, difficulty, score, maxCombo, accuracy, grade)
        ]);

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[Submit Error]', e);
        return new Response(JSON.stringify({ error: true, message: e.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
