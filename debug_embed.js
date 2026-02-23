const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('videos').select('id, title, embedding').limit(10);
    if (error) {
        console.error("DB Error:", error);
        return;
    }

    if (data) {
        console.log("Found videos:", data.length);
        data.forEach(v => {
            const hasEmbedding = v.embedding !== null && v.embedding.length > 0;
            console.log(`Video: "${v.title}" | Embedding: ${hasEmbedding ? 'YES' : 'NO'}`);
        });
    }
}

check();
