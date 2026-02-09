const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase Client
function getSupabase() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    let env = {};

    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        lines.forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                env[match[1].trim()] = match[2].trim().replace(/^["'](.*)["']$/, '$1');
            }
        });
    }

    return createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);
}

async function createMission(userId, goal, obstacle, preferences = {}) {
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
            preferences: preferences
        }])
        .select()
        .single();

    if (missionError) {
        console.error('❌ Failed to create mission:', missionError.message);
        return null;
    }

    console.log(`✅ Mission Created: ${mission.id}`);
    return mission;

    // 2. Find Verified Videos (Placeholder Logic for MVP)
    /* 
       In production, this would be a Vector Search. 
       Currently disabled until we have verified videos in the database.
    */
}

// CLI Execution (Test)
const args = process.argv.slice(2);
if (args.length >= 2) {
    createMission(args[0], args[1], args[2]);
} else {
    console.log('Usage: node tools/create_mission.js <user_id> <goal> [obstacle]');
}
