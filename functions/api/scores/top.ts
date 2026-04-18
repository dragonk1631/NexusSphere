/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from './db_utils';

interface Env {
    DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { env } = context;

    try {
        if (!env.DB) throw new Error('D1 Binding [env.DB] is missing');

        // [자가 치유] 테이블 존재 확인 및 생성
        await ensureTables(env.DB);

        const results = await env.DB.prepare(
            `SELECT u.display_name, s.score, s.accuracy, s.max_combo, s.timestamp
             FROM user_scores s
             LEFT JOIN users u ON s.user_id = u.id
             ORDER BY s.score DESC, s.accuracy DESC
             LIMIT 50`
        ).all();

        return new Response(JSON.stringify(results.results), {
            headers: { 
                'Content-Type': 'application/json'
            }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({
            error: true,
            message: e.message,
            diagnosis: "Top scores query or self-healing failed."
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
