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

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    
    try {
        if (!env.DB) throw new Error('D1 Binding is missing');
        await ensureTables(env.DB);

        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.sub) return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 401 });

        const userId = decoded.sub;

        const stats = await env.DB.prepare('SELECT * FROM user_stats_v2 WHERE user_id = ?').bind(userId).first();
        const records = await env.DB.prepare('SELECT * FROM user_song_records_v2 WHERE user_id = ?').bind(userId).all();

        const defaultStats = {
            user_id: userId,
            level: 1,
            exp: 0,
            total_play_time: 0,
            total_score: 0,
            total_notes_hit: 0,
            max_combo: 0,
            avg_accuracy: 0,
            play_count: 0
        };

        return new Response(JSON.stringify({
            stats: stats || defaultStats,
            records: records.results || []
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
