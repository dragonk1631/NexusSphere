export const onRequestGet = async (context: any) => {
    const { env } = context;
    
    try {
        const stats = await env.DB.prepare('SELECT COUNT(*) as count FROM user_stats_v2').first();
        const v3_records = await env.DB.prepare('SELECT COUNT(*) as count FROM user_song_records_v3').first();
        const songs = await env.DB.prepare('SELECT COUNT(*) as count FROM songs').first();
        const ranks = await env.DB.prepare('SELECT COUNT(*) as count FROM user_rank_stats').first();
        const v2_records = await env.DB.prepare('SELECT COUNT(*) as count FROM user_song_records_v2').first();

        return new Response(JSON.stringify({
            message: "NEXUSSPHERE V3 DATABASE DIAGNOSTIC REPORT",
            timestamp: new Date().toISOString(),
            counts: {
                total_registered_songs: songs?.count || 0,
                v3_normalized_records: v3_records?.count || 0,
                user_stats_v2: stats?.count || 0,
                legacy_v2_records: v2_records?.count || 0,
                user_rank_stats: ranks?.count || 0
            },
            hint: "V3 Normalized Records are the source of truth for the new ranking system."
        }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
