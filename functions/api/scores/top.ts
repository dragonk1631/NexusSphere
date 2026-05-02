/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from './db_utils';

interface Env {
    DB: D1Database;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const { env, request } = context;
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'score';
    const songId = url.searchParams.get('songId');

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        });
    }

    try {
        if (!env.DB) throw new Error('D1 Binding [env.DB] is missing');
        await ensureTables(env.DB);

        let query = '';
        if (songId) {
            // [Server-Side Fix] Song-Specific Leaderboard
            // Use ROW_NUMBER() to ensure we get EXACTLY ONE best record (the highest score) per user.
            // This prevents a single user from dominating the board with multiple difficulty clears.
            query = `
                SELECT * FROM (
                    SELECT 
                        s.user_id, 
                        COALESCE(u.display_name, 'Guest Player') as display_name, 
                        u.avatar_url, 
                        s.high_score as score, 
                        s.best_accuracy as accuracy, 
                        s.max_combo as max_streak, 
                        s.last_played_at as timestamp,
                        COALESCE(u.level, 1) as level,
                        u.play_count,
                        ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.high_score DESC, s.best_accuracy DESC) as rn
                    FROM user_song_records_v2 s
                    LEFT JOIN user_stats_v2 u ON s.user_id = u.user_id
                    WHERE s.song_id = ?
                ) WHERE rn = 1
                ORDER BY score DESC, accuracy DESC
                LIMIT 50
            `;
            const results = await env.DB.prepare(query).bind(songId).all();
            return new Response(JSON.stringify(results.results || []), { 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                } 
            });
        } else {
            // [Server-Side Fix] Global Hall of Fame
            let orderBy = 'total_score DESC';
            let field = 'total_score as score';
            
            if (type === 'combo') {
                orderBy = 'max_streak DESC';
                field = 'max_streak as score';
            } else if (type === 'hits') {
                orderBy = 'total_notes_hit DESC';
                field = 'total_notes_hit as score';
            } else if (type === 'plays') {
                orderBy = 'play_count DESC';
                field = 'play_count as score';
            } else if (type === 'level') {
                orderBy = 'level DESC, exp DESC';
                field = 'level as score';
            }

            // Removed strict 'display_name IS NOT NULL' to include Guest users who have play records
            query = `
                SELECT 
                    user_id, 
                    COALESCE(display_name, 'Guest Player') as display_name, 
                    avatar_url, 
                    ${field}, 
                    max_streak, 
                    play_count, 
                    current_streak, 
                    total_notes_hit, 
                    level, 
                    updated_at as timestamp
                FROM user_stats_v2
                WHERE play_count > 0 OR display_name IS NOT NULL
                ORDER BY ${orderBy}
                LIMIT 50
            `;
            const results = await env.DB.prepare(query).all();
            return new Response(JSON.stringify(results.results || []), { 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                } 
            });
        }
    } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e.message }), { 
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
};
