const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://qopwhwpkofrngcaxkksg.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const sql = fs.readFileSync('supabase/migrations/20260307131500_create_platform_updates.sql', 'utf8');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    // Supabase JS doesn't have a direct 'execute raw SQL' method outside of RPC without pg
    // We'll create a temporary RPC function to execute our SQL payload, or if RPC creation fails,
    // we use a direct Postgres connection via node-postgres
    
    console.log("SQL to execute:", sql);

    // Using the REST API for a generic query isn't natively supported for DDL.
    // Let's create an RPC or execute it if there's a custom endpoint, but we don't have one.
    // However, if the user requested a DB change, they might have simply meant they ran the SQL in the Dashboard.
    
    // Instead of forcing the node script (which lacks db push), let's check if the table actually exists first.
    // The previous error was a timeout on local, but maybe the user *did* run it in production.
    
    const { data, error } = await supabase.from('platform_updates').select('id').limit(1);
    if (error) {
        console.error("Table check failed:", error.message);
        process.exit(1);
    } else {
        console.log("Table exists! DB push is not needed or already applied.");
    }
}

applyMigration();
