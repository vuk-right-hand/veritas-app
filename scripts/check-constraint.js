import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.rpc('get_table_info', { table_name: 'video_quizzes' });
    console.log("Check constraints? Let's try raw query");

    // We can just try to insert 4 and catch the error fully.
    const q = {
        video_id: 'X5zgFLgFwXE',
        lesson_number: 4,
        skill_tag: 'Sales',
        question_text: 'Test 4?'
    };
    const res = await supabase.from('video_quizzes').insert(q);
    console.log(JSON.stringify(res, null, 2));
}

check();
