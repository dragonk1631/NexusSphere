/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from './db_utils';

interface Env {
    DB: D1Database;
}

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

/**
 * [SERVER-AUTHORITATIVE SCORE SUBMISSION]
 * 
 * The server is the SOLE authority on XP, Level, and statistics.
 * The client sends raw play results. The server calculates everything.
 * The response contains the FULL updated stats so the client can display them.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    
    try {
        if (!env.DB) throw new Error('D1 Binding [env.DB] is missing');
        await ensureTables(env.DB);

        // --- AUTH ---
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return new Response('Unauthorized', { status: 401 });

        const token = authHeader.split(' ')[1];
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.sub) return new Response('Unauthorized', { status: 401 });

        const userId = decoded.sub;
        const body: any = await request.json();

        // --- VALIDATION ---
        const { songId, keyMode, difficulty, score, accuracy, maxCombo, grade, isFC, isAP, perfect, great, good, miss, liveStreak, nickname, avatarUrl } = body;
        
        const totalNotesHit = (perfect || 0) + (great || 0) + (good || 0);
        const finalLiveStreak = liveStreak || 0;

        if (!songId || !keyMode || !difficulty || score === undefined) {
            return new Response('Missing required fields', { status: 400 });
        }
        if (score > 5000000 || score < 0) {
            return new Response('Invalid score data', { status: 400 });
        }

        // --- SERVER-SIDE XP CALCULATION (The ONLY XP calculation that matters) ---
        const diffStr = (difficulty || 'NORMAL').toUpperCase();
        const gradeStr = (grade || 'F').toUpperCase();
        
        let diffWeight = 1.0;
        if (diffStr === 'EASY') diffWeight = 0.95;
        else if (diffStr === 'HARD') diffWeight = 1.05;
        else if (diffStr === 'EXPERT' || diffStr === 'EXTREME') diffWeight = 1.1;

        let rankWeight = 0.8;
        if (gradeStr === 'S+') rankWeight = 1.3;
        else if (gradeStr === 'S') rankWeight = 1.2;
        else if (gradeStr === 'A') rankWeight = 1.1;
        else if (gradeStr === 'B') rankWeight = 1.0;

        const serverGainedXP = Math.floor((20 + (maxCombo * 0.1)) * diffWeight * rankWeight + (isAP ? 150 : isFC ? 50 : 0));

        // --- SERVER-SIDE COIN CALCULATION ---
        const serverGainedCoin = Math.floor((10 + (maxCombo * 0.05)) * rankWeight);

        // --- RANK COLUMN ---
        const normalizedGrade = gradeStr.replace('+', '_plus').toLowerCase();
        const rankColumn = `rank_${normalizedGrade}`;

        // --- ATOMIC DB UPDATE ---
        const batchResults = await env.DB.batch([
            // [A] User Stats: Increment XP, Score, PlayCount, Coins
            env.DB.prepare(`
                INSERT INTO user_stats_v2 (
                    user_id, display_name, avatar_url, 
                    exp, total_score, play_count, total_coins, max_combo, max_streak, total_notes_hit, current_streak, updated_at
                )
                VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id) DO UPDATE SET
                    display_name = COALESCE(EXCLUDED.display_name, user_stats_v2.display_name),
                    avatar_url = COALESCE(EXCLUDED.avatar_url, user_stats_v2.avatar_url),
                    exp = user_stats_v2.exp + EXCLUDED.exp,
                    total_score = user_stats_v2.total_score + EXCLUDED.total_score,
                    play_count = user_stats_v2.play_count + 1,
                    total_coins = user_stats_v2.total_coins + EXCLUDED.total_coins,
                    max_combo = MAX(user_stats_v2.max_combo, EXCLUDED.max_combo),
                    max_streak = MAX(user_stats_v2.max_streak, EXCLUDED.max_streak, EXCLUDED.current_streak),
                    total_notes_hit = user_stats_v2.total_notes_hit + EXCLUDED.total_notes_hit,
                    current_streak = EXCLUDED.current_streak,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING exp, total_score, play_count, total_coins, max_combo, max_streak, total_notes_hit, current_streak
            `).bind(userId, nickname, avatarUrl, serverGainedXP, score, serverGainedCoin, maxCombo, maxCombo, totalNotesHit, finalLiveStreak),

            // [B] Rank Stats
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

            // [C] Song Best Record
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
                        WHEN (CASE EXCLUDED.best_grade WHEN 'S+' THEN 4 WHEN 'S' THEN 3 WHEN 'A' THEN 2 WHEN 'B' THEN 1 ELSE 0 END) > 
                             (CASE user_song_records_v2.best_grade WHEN 'S+' THEN 4 WHEN 'S' THEN 3 WHEN 'A' THEN 2 WHEN 'B' THEN 1 ELSE 0 END) 
                        THEN EXCLUDED.best_grade
                        ELSE user_song_records_v2.best_grade
                    END,
                    play_count = user_song_records_v2.play_count + 1,
                    clear_count = user_song_records_v2.clear_count + 1,
                    last_played_at = CURRENT_TIMESTAMP
            `).bind(userId, songId, keyMode, difficulty, score, maxCombo, accuracy, grade)
        ]);

        // --- LEVEL CALCULATION (Server-only, dynamic) ---
        // Extract the RETURNING row from the first batch query
        const updatedStats = batchResults[0]?.results?.[0] as any || {
            exp: serverGainedXP,
            total_score: score,
            play_count: 1,
            total_coins: serverGainedCoin,
            max_combo: maxCombo,
            max_streak: maxCombo,
            total_notes_hit: totalNotesHit
        };
        const currentExp = updatedStats.exp || 0;
        
        const calculatedLevel = Math.floor((-40 + Math.sqrt(1600 + 160 * currentExp)) / 80 + 1);
        const finalLevel = Math.min(Math.max(1, calculatedLevel), 999);
        
        // --- PERSIST LEVEL ---
        // We update the 'level' column so it's indexed and available for the ranking API.
        try {
            await env.DB.prepare('UPDATE user_stats_v2 SET level = ? WHERE user_id = ?').bind(finalLevel, userId).run();
        } catch (e) {
            console.error('[Level Sync Error]', e);
        }

        // --- RESPONSE: Return FULL stats so client can update its display ---
        return new Response(JSON.stringify({ 
            success: true,
            gainedXP: serverGainedXP,
            gainedCoin: serverGainedCoin,
            stats: {
                level: finalLevel,
                exp: currentExp,
                total_score: (updatedStats?.total_score as number) || 0,
                play_count: (updatedStats?.play_count as number) || 0,
                total_coins: (updatedStats?.total_coins as number) || 0,
                max_combo: (updatedStats?.max_combo as number) || 0,
                max_streak: (updatedStats?.max_streak as number) || 0,
                total_notes_hit: (updatedStats?.total_notes_hit as number) || 0,
                current_streak: (updatedStats?.current_streak as number) || 0
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[Submit Error]', e);
        return new Response(JSON.stringify({ error: true, message: e.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};
