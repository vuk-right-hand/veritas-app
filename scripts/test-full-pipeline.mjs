import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFullAnalysisPipeline() {
    console.log("Analyzing a brand new video to ensure 6 questions are saved...");
    try {
        const response = await fetch('http://localhost:3000/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: 'https://www.youtube.com/watch?v=kYIIfifRXXQ' // "How to Speak" - random video
            })
        });

        const data = await response.json();
        if (data.analysis && data.analysis.quiz_questions) {
            console.log(`API returned ${data.analysis.quiz_questions.length} questions in JSON!`);
        } else {
            console.log("API returned error:", data);
        }

        // Wait a few seconds for DB upserts to finish (even though they are awaited sequentially in route.ts)
        await new Promise(r => setTimeout(r, 2000));

        // Check DB directly
        const { data: dbItems, error } = await supabaseClient
            .from('video_quizzes')
            .select('*')
            .eq('video_id', 'kYIIfifRXXQ')
            .order('lesson_number', { ascending: true });

        console.log(`DB has exactly ${dbItems?.length || 0} questions for this video.`);
        if (dbItems) {
            console.log(dbItems.map(i => `  Q${i.lesson_number}: ${i.question_text}`).join('\n'));
        }
    } catch (e) {
        console.error(e);
    }
}

testFullAnalysisPipeline();
