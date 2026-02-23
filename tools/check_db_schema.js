const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
    console.log("Checking 'creators' table...");
    const { data: creators, error: creatorError } = await supabase
        .from('creators')
        .select('*')
        .limit(1);

    if (creatorError) {
        console.log("❌ 'creators' table check failed:", creatorError.message);
    } else {
        console.log("✅ 'creators' table exists.");
    }

    console.log("\nChecking 'auth.users' access (via admin)...");
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

    if (userError) {
        console.log("❌ Admin auth check failed:", userError.message);
    } else {
        console.log("✅ Admin auth check passed. Can list users.");
    }
}

checkSchema();
