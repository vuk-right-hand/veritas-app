const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function forensic() {
    // 1. Get the 3 newest videos added
    const { data: latestVideos } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    // 2. Get the last 10 analytics events of type 'video_view'
    const { data: latestEvents } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('event_type', 'video_view')
        .order('created_at', { ascending: false })
        .limit(10);

    // 3. Get the most recently updated stats in user_creator_stats
    const { data: latestStats } = await supabase
        .from('user_creator_stats')
        .select('*')
        .order('last_watched_at', { ascending: false })
        .limit(5);

    // 4. Check the newest channels registered
    const { data: latestChannels } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    fs.writeFileSync('forensic.json', JSON.stringify({
        latestVideos,
        latestEvents,
        latestStats,
        latestChannels
    }, null, 2));

    console.log("Forensics written to forensic.json");
}

forensic();
