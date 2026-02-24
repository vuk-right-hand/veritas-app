import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getQuizAiModel } from '@/lib/gemini';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Tier thresholds
function calculateTier(score: number): string {
    if (score >= 100) return 'Mythical';
    if (score >= 76) return 'Legendary';
    if (score >= 51) return 'Epic';
    if (score >= 26) return 'Rare';
    return 'Uncommon';
}

export async function POST(req: Request) {
    try {
        const { user_id, video_id, topic, question, user_answer } = await req.json();

        if (!user_id || !video_id || !topic || !question || !user_answer) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Grade with Gemini 1.5 Flash (strict JSON output)
        const prompt = `You are the primary learning evaluator for Veritas, a premium, high-signal educational video app. Your job is to assess a user's answer to a specific question based on a video they just watched.

Your grading philosophy is STRICTLY ENCOURAGING AND FORGIVING. Users are likely typing on mobile devices. If they demonstrate ANY basic understanding of the core concept, you must pass them. Do not grade for grammar, spelling, or academic perfection. Grade for effort and conceptual grasp.

INPUT VARIABLES:
- Topic: ${topic}
- Question: ${question}
- User's Answer: ${user_answer}

YOUR TASK:
1. Determine if the user passed or failed. (Fail them ONLY if the answer is completely blank, outright spam, or 100% contradictory to the topic).
2. Generate exactly 1 to 3 sentences of feedback.
3. Assign a confidence score based on how profound their answer is (low, medium, high). 'High' answers will be featured on their public profile.

FEEDBACK CONSTRAINTS (CRITICAL):
- Sentence 1: MUST be an encouraging affirmation (e.g., "Spot on.", "Great angle.", "Love this approach.").
- Sentence 2: MUST add one specific, actionable expansion on their idea. Connect it to real-world application.
- MAXIMUM length: 3 sentences. MAXIMUM word count: 40 words. Do not exceed this under any circumstances.

OUTPUT FORMAT:
You must respond ONLY with a valid JSON object. No markdown, no conversational text before or after.
{
  "passed": true,
  "confidence": "medium",
  "feedback": "Your strictly 3-sentence feedback goes here."
}`;

        const model = getQuizAiModel();
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonString = responseText.replace(/```json|```/g, '').trim();

        let grading;
        try {
            grading = JSON.parse(jsonString);
        } catch {
            // Fallback: be generous
            grading = { passed: true, confidence: 'low', feedback: 'Great effort! Keep building on this concept.' };
        }

        const passed = grading.passed ?? true;
        const confidence = grading.confidence || 'low';
        const feedback = grading.feedback || 'Keep going!';

        // 2. Insert into quiz_attempts (immutable ledger)
        const { error: attemptError } = await supabaseAdmin
            .from('quiz_attempts')
            .insert({
                user_id,
                video_id,
                topic,
                question,
                user_answer,
                ai_feedback: feedback,
                confidence,
                passed,
            });

        if (attemptError) {
            console.error('❌ Failed to save quiz attempt:', attemptError);
        }

        // 3. If passed, update skills_matrix JSONB in profiles
        if (passed) {
            // Normalize topic to slug
            const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

            // Fetch current skills_matrix (or empty if profile doesn't exist yet)
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('skills_matrix')
                .eq('id', user_id)
                .maybeSingle(); // maybeSingle() returns null instead of error when row not found

            const skillsMatrix = (profile?.skills_matrix as Record<string, any>) || {};
            const currentTopic = skillsMatrix[topicSlug] || { quiz_score: 0, tier: 'Uncommon', portfolio: [] };

            // Increment score (cap at 100)
            const newScore = Math.min(100, currentTopic.quiz_score + 1);
            const newTier = calculateTier(newScore);

            // Portfolio: if confidence is high, unshift to portfolio (max 3)
            const portfolio = currentTopic.portfolio || [];
            if (confidence === 'high') {
                portfolio.unshift({
                    video_id,
                    question,
                    user_answer,
                    ai_feedback: feedback,
                });
                // Cap at 3
                if (portfolio.length > 3) {
                    portfolio.length = 3;
                }
            }

            // Update skills_matrix
            skillsMatrix[topicSlug] = {
                quiz_score: newScore,
                tier: newTier,
                portfolio,
            };

            // Use upsert with onConflict so this works even if the profile row doesn't exist yet
            const { error: upsertError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: user_id,
                    skills_matrix: skillsMatrix,
                }, { onConflict: 'id' });

            if (upsertError) {
                console.error('❌ Failed to upsert skills_matrix:', upsertError);
            } else {
                console.log(`✅ Quiz passed for ${user_id} — ${topicSlug}: ${newScore} (${newTier})`);
            }
        }

        return NextResponse.json({
            success: true,
            passed,
            confidence,
            feedback,
        });

    } catch (error: any) {
        console.error('Quiz Submit Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to process quiz submission',
        }, { status: 500 });
    }
}
