import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { recordVideoOpen } from '@/app/actions/interest-actions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const PROJECT_REF = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';

function decodeJwtPayload(token: string): Record<string, any> | null {
    try {
        const [, payload] = token.split('.');
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    } catch {
        return null;
    }
}

/**
 * POST /api/video-open
 * Lightweight endpoint — fires on modal open to log watch_history immediately.
 * Reuses the same 3-strategy user resolution as /api/watch-progress.
 */
export async function POST(req: Request) {
    try {
        const { videoId } = await req.json();
        if (!videoId) {
            return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        let userId: string | null = null;

        // Strategy 1: veritas_user cookie → user_missions.user_id
        const missionId = cookieStore.get('veritas_user')?.value;
        if (missionId) {
            const { data: mission } = await supabaseAdmin
                .from('user_missions')
                .select('user_id')
                .eq('id', missionId)
                .single();
            userId = mission?.user_id || missionId;
        }

        // Strategy 2: Supabase auth session cookie
        if (!userId && PROJECT_REF) {
            const authCookie = cookieStore.get(`sb-${PROJECT_REF}-auth-token`)?.value;
            if (authCookie) {
                let accessToken = authCookie;
                try {
                    const parsed = JSON.parse(authCookie);
                    if (Array.isArray(parsed)) accessToken = parsed[0];
                    else if (parsed.access_token) accessToken = parsed.access_token;
                } catch { /* Not JSON */ }
                const payload = decodeJwtPayload(accessToken);
                if (payload?.sub) userId = payload.sub;
            }

            if (!userId) {
                const chunk0 = cookieStore.get(`sb-${PROJECT_REF}-auth-token.0`)?.value;
                if (chunk0) {
                    const payload = decodeJwtPayload(chunk0);
                    if (payload?.sub) userId = payload.sub;
                }
            }
        }

        // Strategy 3: anon cookie (don't create one — if they're anon, skip history)
        if (!userId) {
            const anonId = cookieStore.get('veritas_anon')?.value;
            if (anonId) userId = anonId;
        }

        if (!userId) {
            return NextResponse.json({ success: false, message: 'No user identity' }, { status: 200 });
        }

        await recordVideoOpen(videoId, userId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[video-open] Error:', error);
        return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
}
