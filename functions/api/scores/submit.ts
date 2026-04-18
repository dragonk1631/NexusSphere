/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from './db_utils';

interface Env {
    DB: D1Database;
    SCORE_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    
    try {
        if (!env.DB) throw new Error('D1 Binding [env.DB] is missing');
        
        // [자가 치유] 테이블 존재 확인 및 생성
        await ensureTables(env.DB);

        const body: any = await request.json();
        const { userId, userName, songId, score, accuracy, maxCombo, nonce, signature } = body;

        // userName이 없으면 'Anonymous Player'를 기본값으로 사용
        const displayName = userName || 'Anonymous Player';

        if (!userId || !songId || score === undefined || !signature) {
            return new Response('Missing required data', { status: 400 });
        }

        const secret = env.SCORE_SECRET;
        if (!secret) throw new Error('Secret [env.SCORE_SECRET] is missing');
        
        const encoder = new TextEncoder();
        const accStr = (accuracy !== undefined && accuracy !== null) ? accuracy.toFixed(2) : '0.00';
        
        // HMAC 서명 검증 문자열 동기화 (userId:userName:songId:score:accuracy:nonce)
        const dataToVerify = `${userId}:${displayName}:${songId}:${score}:${accStr}:${nonce}`;
        
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const matches = signature.match(/.{1,2}/g);
        if (!matches) return new Response('Invalid signature format', { status: 400 });
        
        const sigArray = new Uint8Array(matches.map((byte: string) => parseInt(byte, 16)));
        const isValid = await crypto.subtle.verify('HMAC', key, sigArray, encoder.encode(dataToVerify));

        if (!isValid) return new Response('Invalid signature', { status: 403 });

        // DB 작업 (상세 에러 캐치)
        try {
            // 유저 정보 업데이트 (UPSERT 패턴)
            await env.DB.prepare(
                `INSERT INTO users (id, display_name) VALUES (?, ?)
                 ON CONFLICT(id) DO UPDATE SET display_name = EXCLUDED.display_name`
            ).bind(userId, displayName).run();

            // 점수 기록
            await env.DB.prepare(
                'INSERT INTO user_scores (user_id, song_id, score, accuracy, max_combo) VALUES (?, ?, ?, ?, ?)'
            ).bind(userId, songId, score, accuracy, maxCombo).run();
        } catch (dbError: any) {
            throw new Error(`[DB Runtime Error] ${dbError.message}`);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({
            error: true,
            message: e.message,
            diagnosis: "Database self-healing attempt failed or runtime error occurred."
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
