const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fix() {
    console.log("Updating test videos from UC_VERITAS_OFFICIAL to 156iq-locked-in-a-room...");
    const { data, error } = await supabase
        .from('videos')
        .update({ channel_id: '156iq-locked-in-a-room' })
        .eq('channel_id', 'UC_VERITAS_OFFICIAL')
        .neq('id', 'dQw4w9WgXcQ') // Keep at least one on official maybe
        .select('id, title, channel_id');

    if (error) {
        console.error("Error updating videos:", error);
    } else {
        console.log(`Successfully updated ${data?.length || 0} videos.`);
    }

    const { data: q } = await supabase.from('channels').update({ status: 'verified' }).eq('youtube_channel_id', '156iq-locked-in-a-room');
}

fix();
