import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { recordWatchProgress } from '@/app/actions/interest-actions';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Project ref extracted from the Supabase URL
const PROJECT_REF = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';

/**
 * Decode a JWT payload without verifying the signature.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
    try {
        const [, payload] = token.split('.');
        const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

/**
 * POST /api/watch-progress
 *
 * Resolves user_id via these strategies (in order):
 *   1. veritas_user cookie → user_missions.user_id (onboarding flow)
 *   2. Supabase auth session cookie → JWT sub (creator/login flow)
 *   3. veritas_anon cookie → persistent anonymous UUID (auto-created for all visitors)
 */
export async function POST(req: Request) {
    try {
        const { videoId, currentTime, duration, realWatchSeconds, lastReportedTime } = await req.json();

        if (!videoId || currentTime === undefined || !duration) {
            return NextResponse.json(
                { error: 'videoId, currentTime, and duration are required' },
                { status: 400 }
            );
        }

        // Use real wall-clock seconds if provided (seek-proof), otherwise fall back to position delta
        const reportedDelta = realWatchSeconds ?? Math.max(0, currentTime - (lastReportedTime || 0));

        const cookieStore = await cookies();
        let userId: string | null = null;
        let resolvedVia = 'none';

        // --- Strategy 1: veritas_user cookie → user_missions.user_id ---
        const missionId = cookieStore.get('veritas_user')?.value;
        if (missionId) {
            const { data: mission } = await supabaseAdmin
                .from('user_missions')
                .select('user_id')
                .eq('id', missionId)
                .single();

            if (mission?.user_id) {
                userId = mission.user_id;
                resolvedVia = 'mission_cookie';
            } else {
                // Mission exists but no linked user — use mission_id directly
                userId = missionId;
                resolvedVia = 'mission_id_direct';
            }
        }

        // --- Strategy 2: Supabase auth session cookie → JWT sub ---
        if (!userId && PROJECT_REF) {
            const authCookieName = `sb-${PROJECT_REF}-auth-token`;
            const authCookieValue = cookieStore.get(authCookieName)?.value;

            if (authCookieValue) {
                let accessToken = authCookieValue;
                try {
                    const parsed = JSON.parse(authCookieValue);
                    if (Array.isArray(parsed)) accessToken = parsed[0];
                    else if (parsed.access_token) accessToken = parsed.access_token;
                } catch { /* Not JSON, use as-is */ }

                const payload = decodeJwtPayload(accessToken);
                if (payload?.sub) {
                    userId = payload.sub;
                    resolvedVia = 'supabase_auth_cookie';
                }
            }

            // Also try chunked cookie format
            if (!userId) {
                const chunk0 = cookieStore.get(`sb-${PROJECT_REF}-auth-token.0`)?.value;
                if (chunk0) {
                    const payload = decodeJwtPayload(chunk0);
                    if (payload?.sub) {
                        userId = payload.sub;
                        resolvedVia = 'supabase_auth_cookie_chunked';
                    }
                }
            }
        }

        // --- Strategy 3: Persistent anonymous UUID cookie ---
        // Every visitor gets a stable UUID stored in a cookie.
        // This lets us track interest scores even before login/onboarding.
        const response = NextResponse.json({ success: true, message: 'pending' });

        if (!userId) {
            let anonId = cookieStore.get('veritas_anon')?.value;
            if (!anonId) {
                anonId = randomUUID();
                // Set a 1-year cookie — will be included in the response
                response.cookies.set('veritas_anon', anonId, {
                    httpOnly: true,
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 365,
                    path: '/',
                });
                console.log(`[watch-progress] Created new anon ID: ${anonId}`);
            }
            userId = anonId;
            resolvedVia = 'anon_cookie';
        }

        console.log(`[watch-progress] User resolved via: ${resolvedVia}, id: ${userId}`);

        // Pass the watchDelta to recordWatchProgress to record creator stats
        const result = await recordWatchProgress(videoId, currentTime, duration, userId, reportedDelta);

        // Merge result into response (preserving the cookie we may have set)
        return new NextResponse(JSON.stringify({ ...result, resolvedVia }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                // Forward any Set-Cookie headers from the response we built
                ...(response.headers.get('Set-Cookie')
                    ? { 'Set-Cookie': response.headers.get('Set-Cookie')! }
                    : {}),
            },
        });
    } catch (error: any) {
        console.error('[watch-progress] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal error' },
            { status: 500 }
        );
    }
}
