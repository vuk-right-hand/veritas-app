require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectTable() {
    console.log('Inspecting videos table...');
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching videos:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Sample Row Keys:', Object.keys(data[0]));
    } else {
        // If empty, try inserting a dummy to see errors or use RPC/admin if possible, 
        // but usually keys are returned if row exists.
        // Let's try to get column info from information_schema via SQL if RPC is available,
        // but standard select is easier if we have data.
        console.log('No videos found, cannot inspect keys easily without admin access to metadata.');

        // Fallback: Try a dry-run insert to see if it complains about missing columns? 
        // No, that's risky.
    }
}

inspectTable();
