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

// Hard fail conditions
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HARD_FAIL_STEMS = ['shit', 'fuck', 'fck', 'fukk', 'dumb', 'dick', 'bitch', 'cunt'];
const HARD_FAIL_WHOLE = ['stupid', 'awful', 'idiot', 'moron', 'f you', 'f u', 'asshole'];
const STEM_RE = new RegExp(`\\b(${HARD_FAIL_STEMS.map(escapeRegex).join('|')})`, 'i');
const WHOLE_RE = new RegExp(`\\b(${HARD_FAIL_WHOLE.map(escapeRegex).join('|')})\\b`, 'i');
const NEGATIVE_PHRASES = ['dont know', "don't know", 'dunno', 'who cares', 'idk', 'i have no idea', 'no idea', 'not sure', 'whatever', 'giving up', 'give up'];

function checkHardFail(answer: string): boolean {
    const trimmed = answer.trim().toLowerCase();

    // 1. One letter answers
    if (trimmed.length <= 1) return true;

    // 2. Swearing/Profanity
    if (STEM_RE.test(trimmed) || WHOLE_RE.test(trimmed)) return true;

    // 3. Negative/Give-up phrases
    if (NEGATIVE_PHRASES.some(phrase => trimmed.includes(phrase))) return true;

    // 4. Gibberish (5+ repeating characters or 20+ character words without spaces)
    if (/(.)\1{4,}/.test(trimmed)) return true;
    if (trimmed.split(/\s+/).some(word => word.length > 20)) return true;

    return false;
}

export async function POST(req: Request) {
    try {
        const { user_id, video_id, topic, question, user_answer } = await req.json();

        if (!user_id || !video_id || !topic || !question || !user_answer) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const isHardFail = checkHardFail(user_answer);

        // 1. Grade with Gemini 1.5 Flash (strict JSON output)
        const prompt = `You are the primary learning evaluator for Veritas, a premium educational app.
Your job is to assess a user's answer to a specific question based on a video they just watched.

INPUT VARIABLES:
- Topic: ${topic}
- Question: ${question}
- User's Answer: ${user_answer}

${isHardFail ? `STATUS: The user has AUTOMATICALLY FAILED due to completely invalid input.
YOUR TASK:
1. Set "passed": false.
2. Set "confidence": "low".
3. Provide a helpful tip or useful information regarding the QUESTION. 
CRITICAL RULE: NEVER explain why they failed. NEVER mention their answer. ONLY provide a useful tip or insight on how to think about the question. (e.g., "A great way to think about this is...").` : `YOUR TASK:
1. Determine if the user passed or failed. Open-ended questions require effort. Single-word answers (e.g. "yes", "no", "me") or completely off-topic answers MUST fail ("passed": false).
2. If they demonstrate basic understanding of the core concept and it's on-topic, they pass ("passed": true). Grade for effort, not grammar.
3. Provide feedback based on their result.

CRITICAL FEEDBACK RULES:
- If passed: Sentence 1 MUST be an encouraging affirmation (e.g., "Spot on.", "Great angle."). Sentence 2 MUST add an actionable expansion.
- If failed: NEVER explain why they failed (don't say "Your answer was too short" or "You missed the point"). INSTEAD, provide a useful tip or piece of information regarding the QUESTION itself (e.g., "When considering [topic], it's highly beneficial to...").`}

GLOBAL CONSTRAINTS:
- MAXIMUM length: 3 sentences. MAXIMUM word count: 40 words. Do not exceed this under any circumstances.
- You must respond ONLY with a valid JSON object. No markdown, no conversational text before or after.

OUTPUT FORMAT:
{
  "passed": ${isHardFail ? "false" : "true or false"},
  "confidence": "low, medium, or high",
  "feedback": "Your strictly compliant feedback goes here."
}`;

        const model = getQuizAiModel();

        // Grading is best-effort for UX: if Gemini throws or returns unparseable JSON,
        // we fall back to a generous pass so the user never sees an error mid-quiz.
        // Fix D below still enforces isHardFail server-side regardless of this fallback.
        let grading: { passed?: boolean; confidence?: string; feedback?: string } = {
            passed: true,
            confidence: 'low',
            feedback: 'Great effort! Keep building on this concept.',
        };
        try {
            const result = await model.generateContent(prompt);
            const jsonString = result.response.text().replace(/```json|```/g, '').trim();
            grading = JSON.parse(jsonString);
        } catch (err) {
            console.error('Quiz grading fallback engaged (generous pass):', err);
        }

        const passed = isHardFail ? false : (grading.passed ?? true);
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
            // SILENT ANTI-CHEAT LOCK: Trap the unique constraint violation
            if (attemptError.code === '23505') {
                console.log(`🛡️ Anti-Cheat: User ${user_id} attempted duplicate quiz for video ${video_id}. Trapping silently.`);
                // We return "success" to the frontend so they don't suspect anything, but we skip the points award.
                return NextResponse.json({
                    success: true,
                    passed,
                    confidence,
                    feedback,
                });
            }

            // Ledger insert failed for a non-unique reason. Log it and keep going —
            // the user should never see an error mid-quiz. Points still award below.
            console.error('❌ Failed to save quiz attempt (continuing for UX):', attemptError);
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

            // Use upsert with onConflict so this works even if the profile row doesn't exist yet.
            // One-shot retry on failure so a transient blip doesn't silently lose the user's point.
            let { error: upsertError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: user_id,
                    skills_matrix: skillsMatrix,
                }, { onConflict: 'id' });

            if (upsertError) {
                console.warn('⚠️ skills_matrix upsert failed, retrying once:', upsertError);
                ({ error: upsertError } = await supabaseAdmin
                    .from('profiles')
                    .upsert({
                        id: user_id,
                        skills_matrix: skillsMatrix,
                    }, { onConflict: 'id' }));
            }

            if (upsertError) {
                console.error('❌ skills_matrix upsert failed after retry (user still sees pass):', upsertError);
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
