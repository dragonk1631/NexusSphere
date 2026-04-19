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
        
        // Auto-heal tables
        await ensureTables(env.DB);

        // 1. Authentication (JWT)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized: Missing Token', { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = decodeJWT(token);
        
        if (!decoded || !decoded.sub) {
            return new Response('Unauthorized: Invalid Token', { status: 401 });
        }

        const userId = decoded.sub; // Clerk User ID
        const body: any = await request.json();
        const { songId, keyMode, difficulty, score, accuracy, maxCombo, gainedXP } = body;

        if (!songId || !keyMode || !difficulty || score === undefined) {
            return new Response('Missing required data', { status: 400 });
        }

        // 2. Database Atomic Update (Batch)
        // We calculate the level locally on the backend for consistency
        try {
            await env.DB.batch([
                // Update User Stats
                env.DB.prepare(`
                    INSERT INTO user_stats_v2 (user_id, level, exp, total_score, play_count, updated_at)
                    VALUES (?, 1, ?, ?, 1, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id) DO UPDATE SET
                        exp = user_stats_v2.exp + EXCLUDED.exp,
                        total_score = user_stats_v2.total_score + EXCLUDED.total_score,
                        play_count = user_stats_v2.play_count + 1,
                        updated_at = CURRENT_TIMESTAMP
                `).bind(userId, gainedXP, score),

                // Update Level based on new Exp (Approximate, as we don't have the absolute sum in the query above yet)
                // Better approach: Calculate level in a second step or with a trigger. 
                // For now, let's just use the client-calculated level or rely on a follow-up query.
                // Actually, let's do a subquery update for level.
                env.DB.prepare(`
                    UPDATE user_stats_v2 
                    SET level = CAST(instr(NULL, NULL) || (sqrt(exp / 100) + 1) AS INTEGER)
                    WHERE user_id = ?
                `).bind(userId),

                // Update Song Record (Best Record)
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
                `).bind(
                    userId, songId, keyMode, difficulty, 
                    score, maxCombo, accuracy, 'S' // Grade logic could be moved here too
                )
            ]);
        } catch (dbError: any) {
            console.error('[DB Error]', dbError.message);
            throw new Error(`[DB Runtime Error] ${dbError.message}`);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({
            error: true,
            message: e.message
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
