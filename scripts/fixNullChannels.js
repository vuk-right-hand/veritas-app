const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fix() {
    // Get all videos with null channel_id
    const { data: videos } = await supabase.from('videos').select('id, channel_id, channel_title, channel_url').is('channel_id', null);
    console.log('Videos with null channel_id:', videos?.length || 0);

    for (const vid of (videos || [])) {
        let handle = 'unknown-channel';
        if (vid.channel_url) {
            const atMatch = vid.channel_url.match(/@([^/]+)/);
            if (atMatch) {
                handle = atMatch[1];
            } else {
                const idMatch = vid.channel_url.match(/channel\/([^/]+)/);
                if (idMatch) handle = idMatch[1];
            }
        }

        console.log(`Fixing video ${vid.id} (${vid.channel_title}) -> channel_id: ${handle}`);

        await supabase.from('videos').update({ channel_id: handle }).eq('id', vid.id);
        await supabase.from('channels').upsert(
            { youtube_channel_id: handle, title: vid.channel_title || 'Unknown', status: 'pending' },
            { onConflict: 'youtube_channel_id' }
        );
    }

    // Verify
    const { data: remaining } = await supabase.from('videos').select('id').is('channel_id', null);
    console.log('Remaining null channel_ids:', remaining?.length || 0);
}

fix();
