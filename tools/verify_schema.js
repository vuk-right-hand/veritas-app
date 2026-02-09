const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🔍 Verifying Schema Changes...');

    // 1. Load Credentials
    const envPath = path.join(__dirname, '..', '.env.local');
    let envList = {};

    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            const match = trimmedLine.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
                envList[key] = value;
            }
        });
    }

    const supabaseUrl = envList['NEXT_PUBLIC_SUPABASE_URL'];
    const supabaseKey = envList['SUPABASE_SERVICE_ROLE_KEY'];

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Check Tables
    const tables = ['user_missions', 'mission_curations'];
    let allGood = true;

    for (const table of tables) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (error) {
            console.error(`❌ Table '${table}' NOT accessible:`, error.message);
            allGood = false;
        } else {
            console.log(`✅ Table '${table}' found.`);
        }
    }

    if (allGood) {
        console.log('🎉 Schema Verification Passed!');
    } else {
        console.error('⚠️ Schema Verification Failed. Did you run the SQL?');
        process.exit(1);
    }
}

main();
