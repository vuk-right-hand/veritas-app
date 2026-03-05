import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testAntiCheat() {
    const testUserId = 'test-user-id-999';
    const testVideoId = 'test-video-id-999';
    const testTopic = 'Testing Lock';
    const testQuestion = 'What is the answer to the universe?';
    const testAnswer = '42';
    const aiFeedback = 'Correct.';
    const confidence = 'high';
    const passed = true;

    console.log('1. Cleaning up previous test records...');
    await supabaseAdmin.from('quiz_attempts').delete().eq('user_id', testUserId).eq('video_id', testVideoId);

    console.log('\n2. First attempt (Should SUCCEED)...');
    const { error: error1 } = await supabaseAdmin.from('quiz_attempts').insert({
        user_id: testUserId,
        video_id: testVideoId,
        topic: testTopic,
        question: testQuestion,
        user_answer: testAnswer,
        ai_feedback: aiFeedback,
        confidence,
        passed,
    });

    if (error1) {
        console.error('❌ First attempt failed:', error1);
        return;
    }
    console.log('✅ First attempt saved successfully.');

    console.log('\n3. Second attempt with exact same question (Should FAIL with 23505)...');
    const { error: error2 } = await supabaseAdmin.from('quiz_attempts').insert({
        user_id: testUserId,
        video_id: testVideoId,
        topic: testTopic,
        question: testQuestion, // Exact same question
        user_answer: testAnswer,
        ai_feedback: aiFeedback,
        confidence,
        passed,
    });

    if (error2) {
        if (error2.code === '23505') {
            console.log('✅ PASS: Caught Expected Unique Violation (23505) - Anti-Cheat is working.');
        } else {
            console.error('❌ Failed with unexpected error:', error2);
        }
    } else {
        console.error('❌ FAIL: The DB allowed a duplicate record! The constraint failed.');
    }

    console.log('\n4. Third attempt with a DIFFERENT question (Should SUCCEED)...');
    const { error: error3 } = await supabaseAdmin.from('quiz_attempts').insert({
        user_id: testUserId,
        video_id: testVideoId,
        topic: testTopic,
        question: 'What is 2+2?', // Different question
        user_answer: '4',
        ai_feedback: 'Correct again.',
        confidence,
        passed,
    });

    if (error3) {
        console.error('❌ Third attempt (different question) failed:', error3);
    } else {
        console.log('✅ PASS: Third attempt (different question) saved successfully.');
    }
}

testAntiCheat();
