import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/fix-profile
 * Backfills a profiles row for an existing auth user identified by their mission cookie or email.
 * Also recomputes skills_matrix from quiz_attempts if the profile exists but skills_matrix is empty.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const missionId = searchParams.get('mission');
        const email = searchParams.get('email');

        if (!missionId && !email) {
            return NextResponse.json({ error: 'Pass ?mission=<cookie> OR ?email=<user_email>' }, { status: 400 });
        }

        let userId = null;
        let missionName = '';
        let missionEmail = '';

        if (email) {
            // Find user_id from user_missions by email
            const { data: missions, error: missionError } = await supabaseAdmin
                .from('user_missions')
                .select('user_id, name, email')
                .eq('email', email)
                .order('created_at', { ascending: false })
                .limit(1);

            if (missionError || !missions || missions.length === 0) {
                return NextResponse.json({ error: 'Mission not found for email', email }, { status: 404 });
            }
            userId = missions[0].user_id;
            missionName = missions[0].name;
            missionEmail = missions[0].email;
        } else if (missionId) {
            // Find user_id from user_missions by missionId
            const { data: mission, error: missionError } = await supabaseAdmin
                .from('user_missions')
                .select('user_id, name, email')
                .eq('id', missionId)
                .single();

            if (missionError || !mission) {
                return NextResponse.json({ error: 'Mission not found for id', missionId }, { status: 404 });
            }
            userId = mission.user_id;
            missionName = mission.name;
            missionEmail = mission.email;
        }

        if (!userId) {
            return NextResponse.json({ error: 'Mission has no user_id' }, { status: 400 });
        }

        // Step 2: Check current profile
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id, skills_matrix')
            .eq('id', userId)
            .maybeSingle();

        // Step 3: If skills_matrix already has data, just return current state
        const existingMatrix = existingProfile?.skills_matrix as Record<string, any> || {};
        const hasData = Object.keys(existingMatrix).length > 0;

        // Step 4: Recompute from quiz_attempts (their quiz history is the source of truth)
        const { data: attempts, error: attemptsError } = await supabaseAdmin
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', userId)
            .eq('passed', true)
            .order('created_at', { ascending: true });

        if (attemptsError) {
            return NextResponse.json({ error: 'Failed to fetch quiz_attempts', details: attemptsError }, { status: 500 });
        }

        // Rebuild the skills_matrix from scratch using all passed attempts
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

        // Step 5: Upsert the profile row with the rebuilt matrix
        const { error: upsertError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                skills_matrix: rebualtMatrix,
            }, { onConflict: 'id' });

        if (upsertError) {
            return NextResponse.json({
                error: 'Failed to upsert profile',
                details: upsertError,
                userId,
                rebualtMatrix,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            userId,
            name: missionName,
            email: missionEmail,
            previousSkillsMatrix: existingMatrix,
            rebualtMatrix,
            attemptsCount: attempts?.length || 0,
            message: hasData
                ? 'Profile already had data — rebuilt and refreshed from quiz_attempts history.'
                : 'Profile row created and skills_matrix rebuilt from quiz_attempts history.',
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
