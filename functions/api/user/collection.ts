/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from '../scores/db_utils';

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

export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
        }
    });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context;

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
    };
    
    try {
        if (!env.DB) throw new Error('D1 Binding is missing');
        await ensureTables(env.DB);

        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS });
        }

        const token = authHeader.split(' ')[1];
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.sub) return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 401, headers: CORS_HEADERS });

        const userId = decoded.sub;

        // Parallel fetch for Professional Collection Data (V3 Normalized)
        const [stats, records, rankCounts] = await Promise.all([
            env.DB.prepare('SELECT * FROM user_stats_v2 WHERE user_id = ?').bind(userId).first(),
            env.DB.prepare(`
                SELECT r.*, s.asset_path as song_id, s.title, s.artist
                FROM user_song_records_v3 r
                JOIN songs s ON r.song_id = s.id
                WHERE r.user_id = ?
            `).bind(userId).all(),
            env.DB.prepare('SELECT * FROM user_rank_stats WHERE user_id = ?').bind(userId).all()
        ]);

        const defaultStats = {
            user_id: userId,
            level: 1,
            exp: 0,
            play_count: 0,
            total_score: 0,
            max_combo: 0
        };

        return new Response(JSON.stringify({
            stats: stats || defaultStats,
            records: records.results || [],
            rankCounts: rankCounts.results || []
        }), {
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
