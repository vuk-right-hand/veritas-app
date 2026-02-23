const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
    // 1. Find user Megi
    const { data: missions } = await supabase.from('user_missions').select('id, user_id, name, email');
    const megi = missions.find(m => m.name === 'Megi' || m.email?.includes('megi') || m.email?.toLowerCase().includes('megi'));

    // 2. Check stats for Megi
    let stats = null;
    let scores = null;
    if (megi) {
        const uid = megi.user_id || megi.id;
        const { data: s } = await supabase.from('user_creator_stats').select('*').eq('user_id', uid);
        stats = s;
        const { data: sc } = await supabase.from('user_interest_scores').select('*').eq('user_id', uid);
        scores = sc;
    }

    // 3. Check videos approved status and channel
    const { data: videos } = await supabase.from('videos').select('id, title, status, channel_id, is_evergreen');

    fs.writeFileSync('debug.json', JSON.stringify({
        missions,
        megi,
        megiStats: stats,
        megiScores: scores,
        videos
    }, null, 2));
}

check();
