const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
    // 1. Get a valid channel_id
    const { data: v } = await supabase.from('videos').select('channel_id').limit(1).single();
    const cid = v?.channel_id;

    // 2. Insert with random uuid
    const randomUuid = "11111111-2222-3333-4444-555555555555";
    const { error: e1 } = await supabase.from('user_creator_stats').insert({ user_id: randomUuid, channel_id: cid, total_watch_seconds: 1 });

    // 3. Try to insert into user_interest_scores
    const { error: e2 } = await supabase.from('user_interest_scores').insert({ user_id: randomUuid, tag: 'productivity', score: 1 });

    fs.writeFileSync('db-check.json', JSON.stringify({
        e1, e2
    }, null, 2));
}

check();
