import { NextResponse } from 'next/server';
import { recordWatchProgress } from '@/app/actions/interest-actions';
import { resolveOrMintViewerId } from '@/lib/viewer-identity';

/**
 * POST /api/watch-progress
 *
 * Resolves viewer id via the shared cascade in src/lib/viewer-identity.ts:
 *   1. veritas_user cookie → user_missions.user_id (onboarding flow)
 *   2. Supabase auth session cookie → JWT sub (creator/login flow)
 *   3. veritas_anon cookie → persistent anonymous UUID (minted here)
 *
 * The cascade order is load-bearing — it MUST match resolveViewerIdReadOnly()
 * used on the feed-read path, otherwise writes and reads key on different ids
 * and personalization silently drops.
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

        // Resolve-and-mint on a throwaway response, do the DB write, then
        // copy any minted cookies onto the final response via the structured
        // ResponseCookies API (getAll/set — NOT headers.get('Set-Cookie'),
        // which joins values and loses attributes in undici). If we skipped
        // this copy, every fresh-anon POST would mint a UUID that never makes
        // it to the browser, the next request mints another, and anon taste
        // vectors would never accumulate.
        const tempResponse = NextResponse.json({});
        const { userId, resolvedVia } = await resolveOrMintViewerId(tempResponse);

        console.log(`[watch-progress] User resolved via: ${resolvedVia}, id: ${userId}`);

        const result = await recordWatchProgress(videoId, currentTime, duration, userId, reportedDelta);

        const finalResponse = NextResponse.json(result);
        for (const c of tempResponse.cookies.getAll()) {
            finalResponse.cookies.set(c);
        }
        return finalResponse;
    } catch (error: any) {
        console.error('[watch-progress] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal error' },
            { status: 500 }
        );
    }
}
