import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking User Missions...");
    const { data: missions, error: mErr } = await supabase
        .from('user_missions')
        .select('*')
        .ilike('name', '%vpppv%');
    console.log(missions || mErr);

    console.log("\nChecking Quiz Attempts...");
    if (missions && missions.length > 0) {
        const userId = missions[0].user_id;
        console.log("Found User ID:", userId);

        const { data: q, error: qErr } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', userId);
        console.log(`Found ${q?.length || 0} quiz attempts for this user.`);

        const { data: p, error: pErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId);
        console.log("Profile data:", p || pErr);
    } else {
        // Find anonymous attempts?
        const { data: qAnon } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', 'anonymous')
            .order('created_at', { ascending: false })
            .limit(5);
        console.log("Recent anonymous quiz attempts:", qAnon);
    }
}
check();
