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
    console.log("=== Testing Raw SQL vs RPC ===\n");

    // Generate embedding
    const result = await model.embedContent("business");
    const embedding = result.embedding.values;
    console.log(`Generated embedding with ${embedding.length} dimensions\n`);

    // Test 1: Via RPC
    console.log("--- Test 1: Via RPC ---");
    const { data: rpcData, error: rpcError } = await supabase.rpc('match_videos', {
        query_embedding: embedding,
        match_threshold: 0.0,
        match_count: 5
    });

    if (rpcError) {
        console.log("RPC Error:", rpcError.message);
    } else {
        console.log(`RPC Success: ${rpcData.length} matches`);
    }

    // Test 2: Via raw SQL
    console.log("\n--- Test 2: Via Raw SQL ---");
    const embeddingStr = `[${embedding.join(',')}]`;

    const { data: sqlData, error: sqlError } = await supabase
        .from('videos')
        .select('id, title, human_score, embedding')
        .not('embedding', 'is', null)
        .limit(5);

    if (sqlError) {
        console.log("SQL Error:", sqlError.message);
    } else {
        console.log(`Found ${sqlData.length} videos with embeddings`);

        // Manually calculate similarity
        sqlData.forEach(v => {
            // Cosine distance calculation
            let dotProduct = 0;
            let normA = 0;
            let normB = 0;

            for (let i = 0; i < embedding.length; i++) {
                dotProduct += embedding[i] * v.embedding[i];
                normA += embedding[i] * embedding[i];
                normB += v.embedding[i] * v.embedding[i];
            }

            const cosineSimilarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
            console.log(`  - ${v.title}: similarity = ${cosineSimilarity.toFixed(4)}`);
        });
    }
}

run();
