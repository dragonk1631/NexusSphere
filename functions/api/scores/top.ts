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

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
            }
        });
    }

    try {
        if (!env.DB) throw new Error('D1 Binding [env.DB] is missing');
        await ensureTables(env.DB);

        let query = '';
        if (type === 'songs') {
            // [V3] Global Song Popularity Ranking (JOIN with songs master table)
            query = `
                SELECT 
                    s.title as display_name,
                    SUM(r.play_count) as score,
                    COUNT(DISTINCT r.user_id) as total_notes_hit,
                    s.asset_path as timestamp
                FROM songs s
                JOIN user_song_records_v3 r ON s.id = r.song_id
                GROUP BY s.id
                ORDER BY score DESC
                LIMIT 50
            `;
        } else if (songId) {
            // [V3] Specific Song User Ranking
            query = `
                SELECT 
                    u.display_name, u.avatar_url, u.level,
                    r.score, r.max_streak, r.accuracy as timestamp
                FROM user_song_records_v3 r
                JOIN user_stats_v2 u ON r.user_id = u.user_id
                JOIN songs s ON r.song_id = s.id
                WHERE s.asset_path = ? OR s.slug = ?
                ORDER BY r.score DESC
                LIMIT 50
            `;
        } else {
            // [V2] Global User Ranking (Level, Score, etc.)
            const column = type === 'score' ? 'total_score' : 
                           type === 'plays' ? 'play_count' : 
                           type === 'level' ? 'exp' : 'total_score';
            
            query = `
                SELECT display_name, avatar_url, level, ${column} as score, updated_at as timestamp
                FROM user_stats_v2
                ORDER BY ${column} DESC
                LIMIT 50
            `;
        }

        const results = await env.DB.prepare(query).bind(...params).all();

        return new Response(JSON.stringify(results.results || []), { 
            headers: { 
                ...CORS_HEADERS,
                'Content-Type': 'application/json' 
            } 
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e.message }), { 
            status: 500,
            headers: { 
                ...CORS_HEADERS,
                'Content-Type': 'application/json' 
            }
        });
    }
};
