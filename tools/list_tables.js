const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function listTables() {
    // This query might not work if permissions are strict, but service role usually can access
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .limit(1);

    if (!error) console.log("✅ Table 'videos' exists");

    // Try to infer other tables or just report what we know
    // Since we can't easily query information_schema with js client typically
    // unless we use rpc or raw sql if exposed

    // Let's try to check for 'channels', 'users', 'profiles'
    const tables = ['channels', 'users', 'profiles', 'creators', 'public_creators'];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ Table '${table}' check: ${error.message}`);
        } else {
            console.log(`✅ Table '${table}' exists`);
        }
    }
}

listTables();
