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
    console.log("=== Testing Different RPC Formats ===\n");

    // Generate embedding
    const result = await model.embedContent("business");
    const embedding = result.embedding.values;
    console.log(`Generated embedding with ${embedding.length} dimensions\n`);

    // Test 1: Plain array (what we've been doing)
    console.log("--- Test 1: Plain Array ---");
    try {
        const { data, error } = await supabase.rpc('match_videos', {
            query_embedding: embedding,
            match_threshold: 0.0,
            match_count: 5
        });

        if (error) {
            console.log("Error:", error.message);
            console.log("Error Code:", error.code);
            console.log("Error Details:", error.details);
        } else {
            console.log(`Success: ${data.length} matches`);
        }
    } catch (e) {
        console.log("Caught Error:", e.message);
    }

    // Test 2: Convert to string (pgvector format)
    console.log("\n--- Test 2: String Format ---");
    try {
        const embeddingStr = `[${embedding.join(',')}]`;
        const { data, error } = await supabase.rpc('match_videos', {
            query_embedding: embeddingStr,
            match_threshold: 0.0,
            match_count: 5
        });

        if (error) {
            console.log("Error:", error.message);
        } else {
            console.log(`Success: ${data.length} matches`);
        }
    } catch (e) {
        console.log("Caught Error:", e.message);
    }
}

run();
