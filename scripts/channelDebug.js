const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function debug() {
    // Get channel schema by looking at existing rows
    const { data: channels } = await supabase.from('channels').select('*').limit(2);

    // Try inserting with all fields matching schema
    const { data: insertData, error: insertError } = await supabase.from('channels').insert({
        youtube_channel_id: 'Itssssss_Jack',
        name: 'Jack Roberts',
        status: 'pending'
    }).select();

    fs.writeFileSync('channel-debug.json', JSON.stringify({
        existingChannels: channels,
        insertData,
        insertError
    }, null, 2));
}

debug();
