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

/**
 * [SERVER-AUTHORITATIVE SYNC API]
 * 
 * This is the ONLY source of truth for logged-in users.
 * It reads from the DB and returns exactly what's there — nothing more, nothing less.
 * 
 * NO migration. NO reconstruction. NO guessing.
 * If the DB is empty, the response is empty. Period.
 */
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
    });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const url = new URL(request.url);
    
    try {
        if (!env.DB) throw new Error('D1 Binding is missing');
        await ensureTables(env.DB);

        // Auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.sub) {
            return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 401 });
        }

        const userId = decoded.sub;

        // --- PARALLEL FETCH: Read everything from DB in one shot (V3 Normalized) ---
        const [stats, recordsResult, rankCountsResult, favoritesResult] = await Promise.all([
            env.DB.prepare('SELECT * FROM user_stats_v2 WHERE user_id = ?').bind(userId).first(),
            env.DB.prepare(`
                SELECT r.*, s.asset_path as song_id 
                FROM user_song_records_v3 r 
                JOIN songs s ON r.song_id = s.id 
                WHERE r.user_id = ?
            `).bind(userId).all(),
            env.DB.prepare('SELECT * FROM user_rank_stats WHERE user_id = ?').bind(userId).all(),
            env.DB.prepare('SELECT song_id FROM user_favorites_v2 WHERE user_id = ?').bind(userId).all()
        ]);

        // --- DYNAMIC LEVEL & NAME SYNC ---
        let finalStats = stats as any;
        if (finalStats) {
            const currentName = url.searchParams.get('name');
            if (currentName && finalStats.display_name !== currentName) {
                await env.DB.prepare('UPDATE user_stats_v2 SET display_name = ? WHERE user_id = ?')
                    .bind(currentName, userId).run();
                finalStats.display_name = currentName;
            }

            // Calculate level dynamically based on exp
            const currentExp = finalStats.exp || 0;
            const calculatedLevel = Math.floor((-40 + Math.sqrt(1600 + 160 * currentExp)) / 80 + 1);
            const finalLevel = Math.min(Math.max(1, calculatedLevel), 999);
            
            // Sync level back to DB if it's out of sync (important for Ranking API)
            if (finalStats.level !== finalLevel) {
                await env.DB.prepare('UPDATE user_stats_v2 SET level = ? WHERE user_id = ?')
                    .bind(finalLevel, userId).run();
                finalStats.level = finalLevel;
            }
        }

        // --- RESPONSE: Return exactly what the DB has ---
        // If stats is null → user has never played. Client must show defaults.
        return new Response(JSON.stringify({
            success: true,
            stats: finalStats || null,
            records: recordsResult.results || [],
            rankCounts: rankCountsResult.results || [],
            favorites: favoritesResult.results?.map((f: any) => f.song_id) || []
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
