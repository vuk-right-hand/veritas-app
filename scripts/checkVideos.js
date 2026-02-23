const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
    let { data: videos, error } = await supabase.from('videos').select('id, title, channel_id');
    fs.writeFileSync('videos-check.json', JSON.stringify({ videos, error }, null, 2));
}

check();
