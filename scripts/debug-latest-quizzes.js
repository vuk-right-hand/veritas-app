import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking newest video quizzes...");
    const { data: recentQuizzes, error: qErr } = await supabase
        .from('video_quizzes')
        .select('video_id, lesson_number')
        .order('created_at', { ascending: false })
        .limit(20);

    if (qErr) {
        console.error(qErr);
        return;
    }

    // Group by video_id
    const counts = {};
    for (const q of recentQuizzes) {
        counts[q.video_id] = (counts[q.video_id] || 0) + 1;
    }

    console.log("Recent question counts per video:");
    console.log(counts);
}

check();
