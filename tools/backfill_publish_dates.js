const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getYouTubePublishDate(videoId) {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
        });
        const html = await response.text();

        // Try multiple patterns
        let match = html.match(/<meta itemprop="uploadDate" content="([^"]+)">/);
        if (!match) match = html.match(/"uploadDate":"([^"]+)"/);
        if (!match) match = html.match(/"publishDate":"([^"]+)"/);

        return match ? match[1] : null;
    } catch (e) {
        console.error(`Failed to fetch date for ${videoId}:`, e.message);
        return null;
    }
}

async function backfillPublishDates() {
    console.log('🔍 Fetching videos from database...\n');

    // Get all videos
    const { data: videos, error } = await supabase
        .from('videos')
        .select('id, title, published_at, created_at');

    if (error) {
        console.error('❌ Error fetching videos:', error);
        return;
    }

    console.log(`Found ${videos.length} videos total\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const video of videos) {
        // Skip if already has valid published_at (not same as created_at)
        if (video.published_at && video.published_at !== video.created_at) {
            console.log(`✓ Skipping ${video.id}: already has published_at`);
            skipped++;
            continue;
        }

        console.log(`\n📹 Processing ${video.id}`);
        console.log(`   Title: ${video.title}`);
        console.log(`   Fetching YouTube publish date...`);

        const publishDate = await getYouTubePublishDate(video.id);

        if (publishDate) {
            const { error: updateError } = await supabase
                .from('videos')
                .update({ published_at: publishDate })
                .eq('id', video.id);

            if (updateError) {
                console.error(`   ❌ Failed to update: ${updateError.message}`);
                failed++;
            } else {
                console.log(`   ✅ Updated published_at to: ${publishDate}`);
                updated++;
            }
        } else {
            console.log(`   ⚠️  Could not find publish date in YouTube HTML`);
            failed++;
        }

        // Rate limit: wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n\n=== BACKFILL COMPLETE ===`);
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped} (already have dates)`);
    console.log(`❌ Failed:  ${failed}`);
    console.log(`📊 Total:   ${videos.length}`);
}

backfillPublishDates().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
