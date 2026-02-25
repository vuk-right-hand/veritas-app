import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPendingAnalysis() {
    const { data: vids, error } = await sb
        .from('videos')
        .select('id, title, status, summary_points')
        .eq('status', 'verified')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('=== RECENT VERIFIED VIDEOS ===');
    for (const v of vids) {
        const hasPts = v.summary_points && v.summary_points.length > 0;
        console.log(`ID: ${v.id} | Has Lessons: ${hasPts} | Title: ${v.title.substring(0, 40)}`);
    }
}

checkPendingAnalysis();
