import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking questions...");
    const { data } = await supabase
        .from('video_quizzes')
        .select('*')
        .eq('video_id', 'iQFTolh1IAk');
    console.log(`Found ${data.length} questions for iQFTolh1IAk`);
    console.log(data.map(q => q.lesson_number));
}

check();
