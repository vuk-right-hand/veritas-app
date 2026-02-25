import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function injectFakeQuestions() {
    console.log("Injecting questions 4, 5, 6 for X5zgFLgFwXE to fix user UI...");

    const fakeQuestions = [
        {
            video_id: 'X5zgFLgFwXE',
            lesson_number: 4,
            skill_tag: 'Sales',
            question_text: 'What is the immediate action you can take to close a client today?'
        },
        {
            video_id: 'X5zgFLgFwXE',
            lesson_number: 5,
            skill_tag: 'Marketing Psychology',
            question_text: 'How does framing your offer as an American business change perceived value?'
        },
        {
            video_id: 'X5zgFLgFwXE',
            lesson_number: 6,
            skill_tag: 'Outreach',
            question_text: 'If you had to cold email 10 US businesses, what is your hook?'
        }
    ];

    for (const q of fakeQuestions) {
        const { error } = await supabase.from('video_quizzes').upsert(q, { onConflict: 'video_id,lesson_number' });
        if (error) console.error("Error:", error);
        else console.log(`Injected Q${q.lesson_number}`);
    }
}

injectFakeQuestions();
