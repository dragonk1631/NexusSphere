/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from './db_utils';

interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context;
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'score'; // score, combo, plays, streak
    const songId = url.searchParams.get('songId');

    try {
        if (!env.DB) throw new Error('D1 Binding [env.DB] is missing');

        await ensureTables(env.DB);

        let query = '';
        if (songId) {
            // Specific song leaderboard
            query = `
                SELECT u.user_id, u.display_name, u.avatar_url, s.high_score as score, s.best_accuracy as accuracy, s.max_combo, s.last_played_at as timestamp
                FROM user_song_records_v2 s
                LEFT JOIN user_stats_v2 u ON s.user_id = u.user_id
                WHERE s.song_id = ?
                ORDER BY s.high_score DESC, s.best_accuracy DESC
                LIMIT 50
            `;
            const results = await env.DB.prepare(query).bind(songId).all();
            return new Response(JSON.stringify(results.results || []), { 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                } 
            });
        } else {
            // Global Hall of Fame rankings
            let orderBy = 'total_score DESC';
            let field = 'total_score as score';
            
            if (type === 'combo') {
                orderBy = 'max_streak DESC';
                field = 'max_streak as score';
            } else if (type === 'plays') {
                orderBy = 'play_count DESC';
                field = 'play_count as score';
            } else if (type === 'streak') {
                orderBy = 'current_streak DESC';
                field = 'current_streak as score';
            } else if (type === 'level') {
                orderBy = 'level DESC, exp DESC';
                field = 'level as score';
            }

            query = `
                SELECT user_id, display_name, avatar_url, ${field}, max_streak, play_count, current_streak, level, updated_at as timestamp
                FROM user_stats_v2
                WHERE display_name IS NOT NULL
                ORDER BY ${orderBy}
                LIMIT 50
            `;
            const results = await env.DB.prepare(query).all();
            return new Response(JSON.stringify(results.results || []), { 
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                } 
            });
        }
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
