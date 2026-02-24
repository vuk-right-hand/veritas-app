import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
    // 1. Force anonymous attempts to belong to Vugla
    const userId = "f4845d63-027f-49b9-810c-89a2e3aeb832";

    await supabaseAdmin.from('quiz_attempts').update({ user_id: userId }).eq('user_id', 'anonymous');

    // 2. Fetch all passed attempts for Vugla
    const { data: attempts } = await supabaseAdmin
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('passed', true);

    // 3. Rebuild skills_matrix
    const rebualtMatrix: Record<string, any> = {};
    for (const attempt of (attempts || [])) {
        const slug = attempt.topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        if (!rebualtMatrix[slug]) {
            rebualtMatrix[slug] = { quiz_score: 0, tier: 'Uncommon', portfolio: [] };
        }
        rebualtMatrix[slug].quiz_score = Math.min(100, rebualtMatrix[slug].quiz_score + 1);

        const score = rebualtMatrix[slug].quiz_score;
        rebualtMatrix[slug].tier = score >= 100 ? 'Mythical'
            : score >= 76 ? 'Legendary'
                : score >= 51 ? 'Epic'
                    : score >= 26 ? 'Rare'
                        : 'Uncommon';

        if (attempt.confidence === 'high' && rebualtMatrix[slug].portfolio.length < 3) {
            rebualtMatrix[slug].portfolio.push({
                video_id: attempt.video_id,
                question: attempt.question,
                user_answer: attempt.user_answer,
                ai_feedback: attempt.ai_feedback,
            });
        }
    }

    // 4. Update the profile
    const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: userId,
            skills_matrix: rebualtMatrix,
        }, { onConflict: 'id' });

    return NextResponse.json({
        success: true,
        message: "Anonymous quiz attempts successfully tied to Vugla and skills re-built!",
        attemptsCount: attempts?.length || 0,
        rebualtMatrix,
    });
}
