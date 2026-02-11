require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Testing match_videos Function ===\n");

    // Get a real video with embedding
    const { data: video } = await supabase
        .from('videos')
        .select('id, title, embedding, human_score')
        .not('embedding', 'is', null)
        .limit(1)
        .single();

    if (!video) {
        console.log("No videos with embeddings found!");
        return;
    }

    console.log(`Test video: "${video.title}"`);
    console.log(`Embedding dimensions: ${video.embedding?.length || 'NULL'}`);
    console.log(`Human score: ${video.human_score}\n`);

    // Test the match function with a simple vector
    console.log("Testing match_videos with 3072-dim vector...");
    const testVector = Array(3072).fill(0.001);

    const { data, error } = await supabase.rpc('match_videos', {
        query_embedding: testVector,
        match_threshold: 0.0,  // Very low to get any results
        match_count: 5
    });

    if (error) {
        console.log("❌ Error:", error.message);
        console.log("Full error:", JSON.stringify(error, null, 2));
    } else {
        console.log(`✅ Success! Found ${data.length} matches`);
        data.forEach((m, i) => {
            console.log(`  ${i + 1}. ${m.title} (similarity: ${m.similarity})`);
        });
    }
}

run();
