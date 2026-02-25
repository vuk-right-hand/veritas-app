import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking User Missions for vpppv...");
    const { data: missions, error: mErr } = await supabase
        .from('user_missions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    console.log("Recent missions:", missions);

    const match = missions.find(m => m.name.toLowerCase().includes('vpppv'));
    if (match) {
        console.log("Found vpppv!", match.user_id);
    }

    console.log("Checking recent quiz attempts...");
    const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('user_id, video_id, created_at, question')
        .order('created_at', { ascending: false })
        .limit(10);
    console.log(attempts);
}

check();
