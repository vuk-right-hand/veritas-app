require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("Testing match_videos with 768 dimensions...");

    // Create dummy 768-dim vector
    const embedding = Array(768).fill(0.1);

    const { data, error } = await supabase.rpc('match_videos', {
        query_embedding: embedding,
        match_threshold: 0.1,
        match_count: 5
    });

    if (error) {
        console.log("768-dim Error:", error.message);
    } else {
        console.log("768-dim Success! Matches found:", data.length);
    }

    console.log("\nTesting match_videos with 3072 dimensions...");

    // Create dummy 3072-dim vector
    const embeddingBig = Array(3072).fill(0.1);

    const { data: data2, error: error2 } = await supabase.rpc('match_videos', {
        query_embedding: embeddingBig,
        match_threshold: 0.1,
        match_count: 5
    });

    if (error2) {
        console.log("3072-dim Error:", error2.message);
    } else {
        console.log("3072-dim Success! Matches found:", data2.length);
    }
}

run();
