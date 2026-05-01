/// <reference types="@cloudflare/workers-types" />
import { ensureTables } from '../scores/db_utils';

interface Env {
    DB: D1Database;
}

/**
 * [ADMIN TOOL] Force-recalculate all user levels from their actual XP in the DB.
 * This does NOT invent data — it only ensures level matches the XP that's already stored.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { env } = context;
    
    try {
        if (!env.DB) throw new Error('D1 Binding is missing');
        await ensureTables(env.DB);

        const { results: users } = await env.DB.prepare('SELECT user_id, exp FROM user_stats_v2').all();
        if (!users || users.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'No users to recalculate', results: [] }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const results: any[] = [];

        for (const user of users as any) {
            const userId = user.user_id;
            const currentExp = user.exp || 0;

            // Recalculate level from stored XP
            const calculatedLevel = Math.floor((-40 + Math.sqrt(1600 + 160 * currentExp)) / 80 + 1);
            const finalLevel = Math.min(Math.max(1, calculatedLevel), 999);

            await env.DB.prepare('UPDATE user_stats_v2 SET level = ? WHERE user_id = ?')
                .bind(finalLevel, userId).run();

            results.push({ userId, exp: currentExp, newLevel: finalLevel });
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Recalculated ${results.length} users`,
            results 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: true, message: e.message }), { 
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};
