import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
    const { data, error } = await supabase
        .from('videos')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        if (data && data.length > 0) {
            console.log('COLUMNS_JSON_START');
            console.log(JSON.stringify(Object.keys(data[0]), null, 2));
            console.log('COLUMNS_JSON_END');
        } else {
            // If no data, we can't see columns via select *.
            // Let's try to infer from error if we select a wrong column?
            // No, let's assume there is data.
            console.log('No data found in videos table.');
        }
    }
}

inspect();
