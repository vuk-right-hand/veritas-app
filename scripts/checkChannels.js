const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
    let { data: channels, error } = await supabase.from('channels').select('*');
    fs.writeFileSync('channels-check.json', JSON.stringify({ channels, error }, null, 2));
}

check();
