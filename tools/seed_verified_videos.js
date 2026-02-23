const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local since dotenv might not be installed
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/"/g, ''); // Remove quotes if any
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SEED_VIDEOS = [
    {
        id: "hJKe5P9y6V4",
        title: "How I Started A $100M Company (In 2024)",
        status: "verified",
        human_score: 98,
        category_tag: "Sales & Marketing",
        channel_id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw", // Alex Hormozi (mock ID)
        summary_points: [
            "The 'Rule of 100' for initial outreach volume",
            "Why you should sell the implementation, not the information",
            "How to structure your first offer for maximum conversion"
        ]
    },
    {
        id: "pL5223_Cq1s",
        title: "The Ultimate Guide To Deep Work",
        status: "verified",
        human_score: 92,
        category_tag: "Productivity",
        summary_points: ["Deep Work vs Shallow Work", "Focus strategies"]
    },
    {
        id: "fN5h1_N4Z4c",
        title: "Stoicism for Modern Life",
        status: "verified",
        human_score: 99,
        category_tag: "Mindset",
        summary_points: ["Control what you can", "The obstacle is the way"]
    }
];

async function seed() {
    console.log('Seeding verified videos...');

    for (const video of SEED_VIDEOS) {
        const { error } = await supabase
            .from('videos')
            .upsert(video, { onConflict: 'id' });

        if (error) {
            console.error(`Error inserting ${video.title}:`, error.message);
        } else {
            console.log(`Inserted/Updated: ${video.title}`);
        }
    }
    console.log('Seed complete.');
}

seed();
