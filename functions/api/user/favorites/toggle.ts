/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from '../../scores/db_utils';

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
    } catch (e) { return null; }
}

/**
 * Toggle Favorite API: Adds or removes a song from user's favorites
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
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
        const body: any = await request.json();
        const { songId, isFavorite } = body;

        if (!songId) return new Response('Missing songId', { status: 400 });

        if (isFavorite) {
            // Add to favorites
            await env.DB.prepare(`
                INSERT INTO user_favorites_v2 (user_id, song_id)
                VALUES (?, ?)
                ON CONFLICT(user_id, song_id) DO NOTHING
            `).bind(userId, songId).run();
        } else {
            // Remove from favorites
            await env.DB.prepare(`
                DELETE FROM user_favorites_v2
                WHERE user_id = ? AND song_id = ?
            `).bind(userId, songId).run();
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e.message }), { status: 500 });
    }
};
