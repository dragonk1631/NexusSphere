/// <reference types="@cloudflare/workers-types" />

/**
 * Simple JWT Decoder for Admin Verification
 */
function decodeJWT(token: string): any {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env, request } = context;
    
    try {
        // 1. Admin Verification
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return new Response('Unauthorized', { status: 401 });

        const token = authHeader.split(' ')[1];
        const decoded = decodeJWT(token);
        
        // Flexible role check (Clerk can place metadata in different locations)
        const role = decoded?.metadata?.role || decoded?.public_metadata?.role || decoded?.role;
        const userId = decoded?.sub;
        
        // [DEV BYPASS] Allow access if role is admin OR if running on localhost for easier testing
        const isLocal = request.url.includes('localhost') || request.headers.get('Host')?.includes('localhost');
        const hasPermission = role === 'admin' || isLocal;

        if (!hasPermission) {
            console.error(`[Admin] Access Denied for ${userId}. Role: ${role}, Local: ${isLocal}`);
            return new Response(`Forbidden: Admin access required. (Your ID: ${userId}, Role: ${role || 'none'})`, { status: 403 });
        }

        // 2. Fetch all user statistics
        const { results } = await env.DB.prepare(`
            SELECT user_id, display_name, avatar_url, level, exp, total_score, play_count, total_coins, updated_at
            FROM user_stats_v2
            ORDER BY updated_at DESC
            LIMIT 200
        `).all();

        return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};

/**
 * Handle user updates/deletions
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { env, request } = context;
    
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.split(' ')[1];
        const decoded = decodeJWT(token || '');
        
        // Flexible role check
        const role = decoded?.metadata?.role || decoded?.public_metadata?.role || decoded?.role;
        const isLocal = request.url.includes('localhost') || request.headers.get('Host')?.includes('localhost');
        const hasPermission = role === 'admin' || isLocal;

        if (!hasPermission) {
            console.error('[Admin-Post] Access Denied:', role);
            return new Response('Forbidden', { status: 403 });
        }

        const body: any = await request.json();
        const { action, targetUserId, data } = body;

        if (action === 'delete') {
            await env.DB.batch([
                env.DB.prepare('DELETE FROM user_stats_v2 WHERE user_id = ?').bind(targetUserId),
                env.DB.prepare('DELETE FROM user_song_records_v3 WHERE user_id = ?').bind(targetUserId),
                env.DB.prepare('DELETE FROM user_rank_stats WHERE user_id = ?').bind(targetUserId)
            ]);
            return new Response(JSON.stringify({ success: true, message: 'User purged' }));
        }

        if (action === 'update_stats') {
            await env.DB.prepare(`
                UPDATE user_stats_v2 
                SET total_coins = ?, level = ?, exp = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `).bind(data.total_coins, data.level, data.exp, targetUserId).run();
            return new Response(JSON.stringify({ success: true, message: 'Stats updated' }));
        }

        return new Response('Invalid Action', { status: 400 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
