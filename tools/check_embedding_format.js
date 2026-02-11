require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Checking Video Embeddings ===\n");

    const { data: videos, error } = await supabase
        .from('videos')
        .select('id, title, embedding')
        .not('embedding', 'is', null)
        .limit(3);

    if (error) {
        console.log("Error:", error.message);
        return;
    }

    console.log(`Found ${videos.length} videos with embeddings\n`);

    videos.forEach((v, i) => {
        console.log(`${i + 1}. "${v.title}"`);
        console.log(`   Embedding type: ${typeof v.embedding}`);
        console.log(`   Is array: ${Array.isArray(v.embedding)}`);
        console.log(`   First 5 values:`, v.embedding?.slice?.(0, 5) || v.embedding);
        console.log(`   Length: ${v.embedding?.length || 'N/A'}`);
        console.log('');
    });
}

run();
