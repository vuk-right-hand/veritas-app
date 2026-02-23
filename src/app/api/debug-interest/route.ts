import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/debug-interest
 * Shows table contents + all cookies + auth session state
 */
export async function GET() {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    // Show cookie names and truncated values
    const cookieSummary = allCookies.map(c => ({
        name: c.name,
        value: c.value.substring(0, 60) + (c.value.length > 60 ? '...' : ''),
        length: c.value.length,
    }));

    // Try to get Supabase auth user
    let authUser = null;
    let authError = null;
    try {
        const { createServerClient } = await import('@supabase/ssr');
        const supabaseServer = createServerClient(
            supabaseUrl,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll() { return cookieStore.getAll(); }, setAll() { } } }
        );
        const { data: { user }, error } = await supabaseServer.auth.getUser();
        authUser = user ? { id: user.id, email: user.email } : null;
        authError = error?.message ?? null;
    } catch (e: any) {
        authError = e.message;
    }

    // Check veritas_user cookie → mission
    const missionId = cookieStore.get('veritas_user')?.value;
    let missionData = null;
    if (missionId) {
        const { data } = await supabase.from('user_missions').select('id, user_id, name').eq('id', missionId).single();
        missionData = data;
    }

    const [tagsResult, scoresResult] = await Promise.all([
        supabase.from('video_tags').select('*').limit(20),
        supabase.from('user_interest_scores').select('*').limit(20),
    ]);

    return NextResponse.json({
        auth: { user: authUser, error: authError },
        mission: { id: missionId, data: missionData },
        cookies: cookieSummary,
        video_tags: { count: tagsResult.data?.length ?? 0, rows: tagsResult.data },
        user_interest_scores: { count: scoresResult.data?.length ?? 0, rows: scoresResult.data },
    });
}

/**
 * POST /api/debug-interest
 * Manually trigger a watch-progress score for testing
 * Body: { videoId, watchPct }
 */
export async function POST(req: Request) {
    const { videoId, watchPct = 100 } = await req.json();

    // 1. Check video_tags for this video
    const { data: tags, error: tagErr } = await supabase
        .from('video_tags')
        .select('*')
        .eq('video_id', videoId);

    // 2. Check all cookies (to debug user resolution)
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map(c => ({ name: c.name, value: c.value.substring(0, 30) + '...' }));

    // 3. Try to find mission
    const missionCookie = cookieStore.get('veritas_user')?.value;
    let missionData = null;
    if (missionCookie) {
        const { data } = await supabase.from('user_missions').select('id, user_id, name').eq('id', missionCookie).single();
        missionData = data;
    }

    // 4. Try auth session
    let authUser = null;
    try {
        const { createServerClient } = await import('@supabase/ssr');
        const supabaseServer = createServerClient(
            supabaseUrl,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll() { return cookieStore.getAll(); }, setAll() { } } }
        );
        const { data: { user } } = await supabaseServer.auth.getUser();
        authUser = user ? { id: user.id, email: user.email } : null;
    } catch (e: any) {
        authUser = { error: e.message };
    }

    return NextResponse.json({
        videoId,
        watchPct,
        video_tags: { count: tags?.length ?? 0, rows: tags, error: tagErr?.message },
        debug: {
            cookies: allCookies,
            missionCookie,
            missionData,
            authUser,
        }
    });
}
