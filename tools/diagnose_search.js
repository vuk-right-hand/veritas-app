require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });

async function run() {
    console.log("=== Full Search Diagnostic ===\n");

    // 1. Check videos with embeddings
    const { data: videos, count } = await supabase
        .from('videos')
        .select('id, title, embedding, category_tag', { count: 'exact' })
        .not('embedding', 'is', null);

    console.log(`Videos with embeddings: ${count}`);
    console.log("Sample videos:");
    videos?.slice(0, 3).forEach(v => {
        console.log(`  - "${v.title}" (category: ${v.category_tag})`);
    });

    // 2. Generate embedding for "business"
    console.log('\n=== Generating Embedding for "business" ===');
    const result = await model.embedContent("business");
    const queryEmbedding = result.embedding.values;
    console.log(`Embedding dimensions: ${queryEmbedding.length}`);

    // 3. Test with different thresholds
    console.log('\n=== Testing Different Match Thresholds ===');

    for (const threshold of [0.0, 0.1, 0.3, 0.5, 0.7]) {
        const { data, error } = await supabase.rpc('match_videos', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: 5
        });

        if (error) {
            console.log(`Threshold ${threshold}: ERROR - ${error.message}`);
        } else {
            console.log(`Threshold ${threshold}: ${data.length} matches`);
            if (data.length > 0) {
                data.forEach(m => {
                    console.log(`  - ${m.title} (similarity: ${m.similarity.toFixed(4)})`);
                });
            }
        }
    }
}

run();
