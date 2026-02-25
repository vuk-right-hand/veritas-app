import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking newest videos for summary_points...");
    const { data: videos, error } = await supabase
        .from('videos')
        .select('id, title, status, summary_points')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error(error);
        return;
    }

    console.log("Recent videos:");
    for (const v of videos) {
        console.log(`- ${v.id} (${v.status}): Has points? ${v.summary_points ? v.summary_points.length : 'NULL'}`);
        if (v.summary_points) console.log(v.summary_points);
    }
}

check();
