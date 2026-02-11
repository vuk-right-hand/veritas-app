const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleKey = process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseKey || !googleKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(googleKey);
const embeddingModel = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });

async function generateEmbedding(text) {
    // embedding-001 naturally outputs 3072 dims for this project apparently
    const result = await embeddingModel.embedContent(text);
    const values = result.embedding.values;
    console.log(`Generated embedding with dimensions: ${values.length}`);
    return values;
}

async function backfill() {
    console.log("Fetching videos without embeddings...");
    // Fetch videos where embedding IS NULL
    // Note: pgvector null check might need raw SQL or specific filter
    // Supabase/PostgREST filter for null is .is('embedding', null)

    const { data: videos, error } = await supabase
        .from('videos')
        .select('id, title, summary_points, category_tag') // Use title + summary + category for embedding context
        .is('embedding', null);

    if (error) {
        console.error("DB Fetch Error:", error);
        return;
    }

    console.log(`Found ${videos.length} videos to backfill.`);

    for (const video of videos) {
        console.log(`Processing: ${video.title}`);
        // Initialize context outside to be visible in catch
        let context = "";
        try {
            // Construct a rich context string for the embedding
            // "Title: How to win. Category: Business. Summary: Do hard work. Be consistent."
            const summary = Array.isArray(video.summary_points) ? video.summary_points.join(' ') : "";
            context = `Title: ${video.title}. Category: ${video.category_tag}. Summary: ${summary}`;

            const embedding = await generateEmbedding(context);

            const { error: updateError } = await supabase
                .from('videos')
                .update({ embedding: embedding })
                .eq('id', video.id);

            if (updateError) {
                console.error(`Failed to update ${video.title}:`, updateError);
            } else {
                console.log(`✅ Saved embedding for: ${video.title}`);
            }

            // Rate limit kindness
            await new Promise(r => setTimeout(r, 500));

        } catch (e) {
            console.error(`Error processing ${video.title}:`);
            console.error(`Status: ${e.status}`);
            console.error(`Payload: "${context.substring(0, 100)}..."`);
            console.error("Error Message:", e.message);
            console.error("Error Stack:", e.stack);
            console.error("Full Error:", e);
        }
    }

    console.log("Backfill complete.");
}

backfill();
