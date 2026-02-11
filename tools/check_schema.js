const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env explicitly
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
        if (key.trim() === 'DATABASE_URL') {
            console.log('DATABASE_URL found!');
        }
    });
}


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking schema for "videos" table...');

    // We can't query information_schema easily with supabase-js unless we use rpc or raw sql if exposed.
    // Instead, let's just select a single row and see the keys.
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Existing columns based on first row:', Object.keys(data[0]));
    } else {
        console.log('Table is empty, cannot infer columns from data.');
        // Try inserting a dummy row to fail and see error? No, that's messy.
        // Let's assume standard columns.
    }
}

checkSchema();
