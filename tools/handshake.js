const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🤝 Starting B.L.A.S.T. Handshake Protocol...');

    // 1. Load Credentials from .env.local manually
    const envPath = path.join(__dirname, '..', '.env.local');
    let envList = {};

    if (fs.existsSync(envPath)) {
        console.log(`📂 Reading .env.local from: ${envPath}`);
        const envContent = fs.readFileSync(envPath, 'utf8');

        envContent.split('\n').forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return; // Skip empty or comments

            const match = trimmedLine.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["'](.*)["']$/, '$1'); // Remove wrapping quotes if present
                envList[key] = value;
            }
        });
    } else {
        console.error(`❌ .env.local not found at: ${envPath}`);
        process.exit(1);
    }

    const supabaseUrl = envList['NEXT_PUBLIC_SUPABASE_URL'];
    const supabaseKey = envList['SUPABASE_SERVICE_ROLE_KEY'];

    // Debug: Print keys found (masking values)
    console.log('🔑 Keys found in .env.local:', Object.keys(envList));

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing credentials in .env.local');
        if (!supabaseUrl) console.error('   - Missing NEXT_PUBLIC_SUPABASE_URL');
        if (!supabaseKey) console.error('   - Missing SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    console.log(`✅ Credentials Loaded.`);

    // 2. Initialize Client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Test Connection (Read Profiles)
    console.log('📡 Pinging Supabase (Table: profiles)...');
    const { data, error, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('❌ Handshake Failed:', error.message);
        console.error('   Details:', error);
        process.exit(1);
    }

    console.log('✅ Connection Successful!');
    console.log('🤝 Handshake Complete.');
}

main();
