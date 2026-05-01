export const onRequestGet = async (context: any) => {
    const { env } = context;
    
    try {
        const stats = await env.DB.prepare('SELECT COUNT(*) as count FROM user_stats_v2').first();
        const records = await env.DB.prepare('SELECT COUNT(*) as count FROM user_song_records_v2').first();
        const ranks = await env.DB.prepare('SELECT COUNT(*) as count FROM user_rank_stats').first();
        const scores = await env.DB.prepare('SELECT COUNT(*) as count FROM user_scores').first();
        const users = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();

        return new Response(JSON.stringify({
            message: "DATABASE DIAGNOSTIC REPORT",
            timestamp: new Date().toISOString(),
            counts: {
                user_stats_v2: stats?.count || 0,
                user_song_records_v2: records?.count || 0,
                user_rank_stats: ranks?.count || 0,
                user_scores: scores?.count || 0,
                users: users?.count || 0
            },
            hint: "If these are all 0 but you still see data in the game, your browser is showing cached data."
        }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
