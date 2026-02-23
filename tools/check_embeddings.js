require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log("=== Checking Embeddings Status ===\n");

    // 1. Count total videos
    const { count: totalCount } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true });

    console.log(`Total videos: ${totalCount}`);

    // 2. Count videos WITH embeddings
    const { count: withEmbeddings } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null);

    console.log(`Videos with embeddings: ${withEmbeddings}`);

    // 3. Count videos WITHOUT embeddings
    const { count: withoutEmbeddings } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .is('embedding', null);

    console.log(`Videos WITHOUT embeddings: ${withoutEmbeddings}\n`);

    // 4. Sample a few videos to check their data
    const { data: samples } = await supabase
        .from('videos')
        .select('title, embedding')
        .not('embedding', 'is', null)
        .limit(3);

    console.log("=== Sample Videos ===");
    samples?.forEach((v, i) => {
        console.log(`${i + 1}. "${v.title}"`);
        console.log(`   Embedding: ${v.embedding ? `[${v.embedding.length} dimensions]` : 'NULL'}`);
    });
}

run();
