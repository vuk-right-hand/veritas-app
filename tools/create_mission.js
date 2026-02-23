const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase Client
function getSupabase() {
    const envPath = path.join(__dirname, '..', '.env.local');
    // Check if .env.local exists
    if (!fs.existsSync(envPath)) {
        console.error('❌ Error: .env.local file not found.');
        process.exit(1);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    let env = {};

    const lines = envContent.split('\n');
    lines.forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            env[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
        }
    });

    if (!env['NEXT_PUBLIC_SUPABASE_URL'] || !env['SUPABASE_SERVICE_ROLE_KEY']) {
        console.error('❌ Error: Missing Supabase credentials in .env.local');
        process.exit(1);
    }

    return createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
}

async function createMission(userId, goal, obstacle, preferences = {}) {
    if (!userId || !goal) {
        console.error('❌ Error: Missing required fields (userId, goal).');
        return null;
    }

    const supabase = getSupabase();
    console.log(`🚀 Creating Mission for User: ${userId}`);
    console.log(`   Goal: ${goal}`);
    console.log(`   Obstacle: ${obstacle || 'None'}`);

    // 1. Insert Mission
    const { data: mission, error: missionError } = await supabase
        .from('user_missions')
        .insert([{
            user_id: userId,
            goal: goal,
            obstacle: obstacle,
            preferences: preferences,
            status: 'active'
        }])
        .select()
        .single();

    if (missionError) {
        console.error('❌ Failed to create mission:', missionError.message);
        return null;
    }

    console.log(`✅ Mission Created: ${mission.id}`);

    // 2. Find Verified Videos
    // Logic: Fetch videos with status='verified'.
    // MVP: Randomly select up to 3 verified videos.
    const { data: videos, error: videoError } = await supabase
        .from('videos')
        .select('id, title, channel_id, human_score, status')
        .eq('status', 'verified')
        .limit(10); // Fetch a batch to pick from

    if (videoError) {
        console.error('⚠️ Error fetching videos:', videoError.message);
    }

    let selectedVideos = [];
    if (videos && videos.length > 0) {
        // Randomly shuffle and pick 3
        selectedVideos = videos.sort(() => 0.5 - Math.random()).slice(0, 3);
        console.log(`Found ${videos.length} verified videos. Selected ${selectedVideos.length} for curation.`);
    } else {
        console.log('⚠️ No verified videos found. Mission created without curations.');
    }

    // 3. Insert Curations
    if (selectedVideos.length > 0) {
        const curations = selectedVideos.map(video => ({
            mission_id: mission.id,
            video_id: video.id,
            curation_reason: `Matches your goal: "${goal}" (MVP Match)`
        }));

        const { error: curationError } = await supabase
            .from('mission_curations')
            .insert(curations);

        if (curationError) {
            console.error('❌ Failed to insert curations:', curationError.message);
        } else {
            console.log(`✅ Linked ${curations.length} videos to mission.`);
        }
    }

    // 4. Return Full Payload
    // Fetch mission with curations and video details
    const { data: fullMission, error: fetchError } = await supabase
        .from('user_missions')
        .select(`
            *,
            mission_curations (
                curation_reason,
                videos (
                    id,
                    title,
                    human_score,
                    channel_id,
                    status
                )
            )
        `)
        .eq('id', mission.id)
        .single();

    if (fetchError) {
        console.error('❌ Error fetching full mission details:', fetchError.message);
        return mission; // Return basic mission if fetch fails
    }

    console.log('✅ Mission Flow Complete.');
    console.log(JSON.stringify(fullMission, null, 2));
    return fullMission;
}

// CLI Execution (Test)
const args = process.argv.slice(2);
if (args.length >= 2) {
    // Parse preferences if 4th arg exists, otherwise default
    let prefs = {};
    if (args[3]) {
        try {
            prefs = JSON.parse(args[3]);
        } catch (e) {
            console.warn('⚠️ Invalid JSON for preferences, using default.');
        }
    }
    createMission(args[0], args[1], args[2], prefs);
} else {
    console.log('Usage: node tools/create_mission.js <user_id> <goal> [obstacle] [preferences_json]');
}
