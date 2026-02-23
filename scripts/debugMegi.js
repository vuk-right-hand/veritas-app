const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function debugMegi() {
    const megiUid = "b94606d5-4fa9-4016-ab10-df3e1886a823";

    // Check if Megi is in profiles
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', megiUid).single();

    // Simulate recording watch progress
    const videoId = "dQw4w9WgXcQ"; // one of the videos that has UC_VERITAS_OFFICIAL because I changed it
    const reportedDelta = 53;

    // Fetch video
    const { data: videoData } = await supabase.from('videos').select('channel_id').eq('id', videoId).single();

    // Try to upsert directly
    const { data: upsertData, error: upsertError } = await supabase
        .from('user_creator_stats')
        .upsert({
            user_id: megiUid,
            channel_id: videoData.channel_id,
            total_watch_seconds: reportedDelta,
            last_watched_at: new Date().toISOString()
        }, { onConflict: 'user_id,channel_id' })
        .select();

    fs.writeFileSync('megi-debug.json', JSON.stringify({
        profileFound: !!profile,
        profile,
        videoChannel: videoData,
        upsertData,
        upsertError
    }, null, 2));
}

debugMegi();
