import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getAiModel } from '@/lib/gemini';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST() {
    try {
        const cookieStore = await cookies();
        const missionId = cookieStore.get('veritas_user')?.value;

        let topInterests: { tag: string; score: number }[] = [];
        let goal = '';
        let obstacle = '';

        // 1. If we have a session, fetch user data
        if (missionId) {
            const { data: mission } = await supabase
                .from('user_missions')
                .select('user_id, goal, obstacle')
                .eq('id', missionId)
                .single();

            if (mission) {
                goal = mission.goal || '';
                obstacle = mission.obstacle || '';

                // 2. Fetch top interest scores (highest first) — this is the primary signal
                const { data: interests } = await supabase
                    .from('user_interest_scores')
                    .select('tag, score')
                    .eq('user_id', mission.user_id)
                    .order('score', { ascending: false })
                    .limit(10);

                topInterests = interests || [];
            }
        }

        // 3. Build an AI prompt — interests FIRST, goals/obstacles as secondary context
        const hasInterests = topInterests.length > 0;
        const hasGoals = goal || obstacle;

        let contextSection = '';

        if (hasInterests) {
            const interestList = topInterests
                .map(i => `"${i.tag}" (score: ${i.score})`)
                .join(', ');
            contextSection += `PRIMARY SIGNAL — The user's top watched topics (by score): ${interestList}.\n`;
        }

        if (hasGoals) {
            if (goal) contextSection += `SECONDARY — User's stated goal: "${goal}".\n`;
            if (obstacle) contextSection += `SECONDARY — User's stated obstacle: "${obstacle}".\n`;
        }

        if (!contextSection) {
            // Fallback: no data at all — return generic best-performer topics
            contextSection = 'The user is new and has no watch history. Suggest broad self-improvement search terms.';
        }

        const prompt = `
You are a smart search assistant for Veritas, a curated video platform focused on real human knowledge and self-improvement.

${contextSection}

Based on this context, generate EXACTLY 3 short, specific search query suggestions the user could type into the search bar to find videos relevant to their interests and goals. 

Rules:
- Prioritize the PRIMARY SIGNAL (watch history scores) heavily over the secondary goal/obstacle text.
- Each suggestion should be 2–6 words, like a natural search query.
- Make them feel insightful and personalized, not generic.
- Do NOT include numbering or bullet points.
- Return ONLY the 3 suggestions, one per line, nothing else.
`;

        const model = getAiModel();
        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        // Parse: split by newlines, filter empty, take first 3
        const suggestions = responseText
            .split('\n')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
            .slice(0, 3);

        return NextResponse.json({ success: true, suggestions });

    } catch (error: any) {
        console.error('[Suggest] Error:', error.message);
        return NextResponse.json({ success: false, suggestions: [] }, { status: 500 });
    }
}
