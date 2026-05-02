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

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

        // --- AUTH ---
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });

        const token = authHeader.split(' ')[1];
        const decoded = decodeJWT(token);
        if (!decoded || !decoded.sub) return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });

        const userId = decoded.sub;
        const body: any = await request.json();

        // --- VALIDATION ---
        const { songId, keyMode, difficulty, score, accuracy, maxCombo, grade, isFC, isAP, perfect, great, good, miss, liveStreak, nickname, avatarUrl } = body;
        
        const totalNotesHit = (perfect || 0) + (great || 0) + (good || 0);
        const finalLiveStreak = liveStreak || 0;

        if (!songId || !keyMode || !difficulty || score === undefined) {
            return new Response('Missing required fields', { status: 400, headers: CORS_HEADERS });
        }

        // --- SERVER-SIDE XP & COIN CALCULATION ---
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
        const serverGainedCoin = Math.floor((10 + (maxCombo * 0.05)) * rankWeight);

        // --- AUTO-REGISTER SONG & V3 RECORDING ---
        const cleanSlug = songId.split('/').pop()?.replace(/\.(mid|mp3|wav)$/i, '').toLowerCase() || 'unknown';
        const cleanTitle = songId.split('/').pop()?.replace(/\.(mid|mp3|wav)$/i, '') || 'Unknown Track';

        await env.DB.prepare(`
            INSERT OR IGNORE INTO songs (slug, title, asset_path) 
            VALUES (?, ?, ?)
        `).bind(cleanSlug, cleanTitle, songId).run();

        const songMaster = await env.DB.prepare(`SELECT id FROM songs WHERE asset_path = ?`).bind(songId).first() as any;
        const songPk = songMaster?.id;

        // --- ATOMIC DB UPDATE ---
        const batchResults = await env.DB.batch([
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

            env.DB.prepare(`
                INSERT INTO user_song_records_v3 (
                    user_id, song_id, key_mode, difficulty, score, max_streak, play_count, accuracy, last_played_at
                )
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, song_id, key_mode, difficulty) DO UPDATE SET
                    score = MAX(user_song_records_v3.score, EXCLUDED.score),
                    max_streak = MAX(user_song_records_v3.max_streak, EXCLUDED.max_streak),
                    play_count = user_song_records_v3.play_count + 1,
                    accuracy = MAX(user_song_records_v3.accuracy, EXCLUDED.accuracy),
                    last_played_at = CURRENT_TIMESTAMP
            `).bind(userId, songPk, keyMode, difficulty, score, maxCombo, accuracy)
        ]);

        const updatedStats = batchResults[0]?.results?.[0] as any;
        const currentExp = updatedStats?.exp || 0;
        const calculatedLevel = Math.floor((-40 + Math.sqrt(1600 + 160 * currentExp)) / 80 + 1);
        const finalLevel = Math.min(Math.max(1, calculatedLevel), 999);
        
        await env.DB.prepare('UPDATE user_stats_v2 SET level = ? WHERE user_id = ?').bind(finalLevel, userId).run();

        return new Response(JSON.stringify({ 
            success: true, 
            gainedXP: serverGainedXP, 
            gainedCoin: serverGainedCoin,
            stats: { level: finalLevel, ...updatedStats }
        }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e.message }), { 
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
    }
};
