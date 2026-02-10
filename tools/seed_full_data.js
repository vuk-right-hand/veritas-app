const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8');
const env = {};
envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim().replace(/"/g, '');
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CHANNELS = [
    {
        id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw",
        title: "Alex Hormozi",
        description: "Business scaling strategies.",
        custom_url: "@AlexHormozi",
        thumbnail_url: "https://yt3.googleusercontent.com/ytc/AIdro_n4...",
        status: "verified"
    },
    {
        id: "UCRLEADhMkbHMquftRCTG6jA",
        title: "Cal Newport",
        description: "Author of Deep Work.",
        custom_url: "@calnewport",
        status: "verified"
    },
    {
        id: "UCt_t6FwNsqr3wwkD9xoUgPw",
        title: "Ryan Holiday",
        description: "Stoicism.",
        custom_url: "@DailyStoic",
        status: "verified"
    }
];

const VIDEOS = [
    {
        id: "hJKe5P9y6V4",
        title: "How I Started A $100M Company (In 2024)",
        status: "verified",
        human_score: 98,
        category_tag: "Sales & Marketing",
        channel_id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw",
        summary_points: ["Rule of 100", "Sell implementation"]
    },
    {
        id: "pL5223_Cq1s",
        title: "The Ultimate Guide To Deep Work",
        status: "verified",
        human_score: 92,
        category_tag: "Productivity",
        channel_id: "UCRLEADhMkbHMquftRCTG6jA",
        summary_points: ["Deep Work vs Shallow Work"]
    },
    {
        id: "fN5h1_N4Z4c",
        title: "Stoicism for Modern Life",
        status: "verified",
        human_score: 99,
        category_tag: "Mindset",
        channel_id: "UCt_t6FwNsqr3wwkD9xoUgPw",
        summary_points: ["Control what you can"]
    }
];

async function seed() {
    console.log('Seeding channels...');
    for (const channel of CHANNELS) {
        const { error } = await supabase.from('channels').upsert(channel, { onConflict: 'id' });
        if (error) console.error(`Error channel ${channel.title}:`, error.message);
        else console.log(`Channel saved: ${channel.title}`);
    }

    console.log('Seeding videos...');
    for (const video of VIDEOS) {
        const { error } = await supabase.from('videos').upsert(video, { onConflict: 'id' });
        if (error) console.error(`Error video ${video.title}:`, error.message);
        else console.log(`Video saved: ${video.title}`);
    }

    console.log('Seed complete.');
}

seed();
