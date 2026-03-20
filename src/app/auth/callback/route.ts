import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { saveMissionForOAuthUser, finalizeOAuthChannelClaim, establishOAuthViewerSession } from '../../actions/oauth-actions';
import { getPendingMission, clearPendingMission, getPendingClaim, clearPendingClaim } from '../../actions/pending-data-actions';

function errorDest(flow: string | null, errorParam: string, origin: string): URL {
    if (flow === 'claim' || flow === 'creator-login') {
        return new URL(`/claim-channel?error=${errorParam}`, origin);
    }
    if (flow === 'onboarding') {
        return new URL(`/onboarding?error=${errorParam}`, origin);
    }
    return new URL(`/login?error=${errorParam}`, origin);
}

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const flow = searchParams.get('flow') as 'onboarding' | 'claim' | 'login' | 'creator-login' | null;
    console.log(`[auth/callback] flow=${flow}, origin=${origin}, next=${searchParams.get('next')}, fullUrl=${request.url}`);

    if (!code) {
        return NextResponse.redirect(errorDest(flow, 'no_code', origin));
    }

    // Build SSR client with cookie persistence
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch { /* Server Component context — safe to ignore */ }
                },
            },
        }
    );

    // Exchange PKCE code for session
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !session) {
        console.error('[auth/callback] Code exchange failed:', error?.message);
        return NextResponse.redirect(errorDest(flow, 'exchange_failed', origin));
    }

    const user = session.user;
    const userId = user.id;
    const email = user.email || '';
    const name = user.user_metadata?.full_name
        || user.user_metadata?.name
        || user.user_metadata?.preferred_username
        || '';

    // --- GitHub private email edge case ---
    if (!email && user.app_metadata?.provider === 'github') {
        return NextResponse.redirect(
            new URL('/onboarding?error=no_email&provider=github', origin)
        );
    }

    // --- Route based on flow type ---
    let destinationResponse: NextResponse;

    // Read `next` param — used to return user to previous context after auth
    const next = searchParams.get('next');
    const safeNext = (next && next.startsWith('/') && !next.startsWith('//')) ? next : null;

    try {
        if (flow === 'onboarding') {
            destinationResponse = await handleOnboarding(userId, email, name, origin, safeNext);
        } else if (flow === 'claim') {
            destinationResponse = await handleClaim(userId, email, name, session.provider_token, origin);
        } else if (flow === 'creator-login') {
            destinationResponse = NextResponse.redirect(new URL('/creator-dashboard', origin));
        } else {
            // Login flow — establish viewer session then redirect
            destinationResponse = await handleLogin(userId, origin, safeNext);
        }
    } catch (err) {
        console.error('[auth/callback] Unexpected error:', err);
        destinationResponse = NextResponse.redirect(errorDest(flow, 'callback_error', origin));
    }

    // Critical Next.js 14 App Router Bug Fix:
    // `cookies().set()` during route handlers DOES NOT automatically attach
    // `Set-Cookie` headers to `NextResponse.redirect()` responses.
    // We must explicitly retrieve the mutated cookies and attach them to the outgoing response.
    const allCookies = cookieStore.getAll();
    allCookies.forEach(c => {
        // @ts-ignore - The types for NextJS cookie options are slightly annoying
        destinationResponse.cookies.set(c.name, c.value, { ...c });
    });

    return destinationResponse;
}

// -------------------------------------------------------------------
// Flow handlers
// -------------------------------------------------------------------

async function handleOnboarding(
    userId: string,
    email: string,
    name: string,
    origin: string,
    next: string | null
): Promise<NextResponse> {
    const pending = await getPendingMission();

    if (!pending) {
        // Cookie expired or missing — restart onboarding
        return NextResponse.redirect(new URL('/onboarding?error=session_expired', origin));
    }

    const result = await saveMissionForOAuthUser(
        userId,
        email,
        name,
        pending.goal,
        pending.struggle
    );

    await clearPendingMission();

    if (!result.success) {
        return NextResponse.redirect(new URL('/onboarding?error=mission_failed', origin));
    }

    return NextResponse.redirect(new URL(next || '/dashboard', origin));
}

async function handleClaim(
    userId: string,
    email: string,
    name: string,
    providerToken: string | null | undefined,
    origin: string
): Promise<NextResponse> {
    const pending = await getPendingClaim();

    if (!pending) {
        return NextResponse.redirect(new URL('/claim-channel?error=session_expired', origin));
    }

    if (!providerToken) {
        await clearPendingClaim();
        return NextResponse.redirect(
            new URL('/claim-channel?error=missing_youtube_access', origin)
        );
    }

    // Verify YouTube channel ownership via provider_token
    const verification = await verifyYouTubeOwnership(providerToken, pending.channelUrl);

    if (!verification.verified) {
        await clearPendingClaim();
        const errorParam = verification.error || 'channel_mismatch';
        return NextResponse.redirect(
            new URL(`/claim-channel?error=${errorParam}`, origin)
        );
    }

    // Channel matches — finalize the claim
    const result = await finalizeOAuthChannelClaim(userId, email, {
        url: pending.channelUrl,
        title: pending.channelName || verification.channelTitle || '',
        channelId: verification.channelId!,
    });

    await clearPendingClaim();

    if (!result.success) {
        return NextResponse.redirect(
            new URL(`/claim-channel?error=claim_failed&message=${encodeURIComponent(result.message || '')}`, origin)
        );
    }

    return NextResponse.redirect(new URL('/creator-dashboard', origin));
}

async function handleLogin(
    userId: string,
    origin: string,
    next: string | null
): Promise<NextResponse> {
    const result = await establishOAuthViewerSession(userId);
    // New users MUST complete onboarding first — never let `next` skip it
    if (result.isNewUser) {
        const onboardingUrl = next
            ? `/onboarding?next=${encodeURIComponent(next)}`
            : '/onboarding';
        return NextResponse.redirect(new URL(onboardingUrl, origin));
    }
    // Existing user — use `next` param if provided, otherwise default destination
    return NextResponse.redirect(new URL(next || result.destination, origin));
}

// -------------------------------------------------------------------
// YouTube channel ownership verification
// -------------------------------------------------------------------

async function verifyYouTubeOwnership(
    providerToken: string,
    claimedChannelUrl: string
): Promise<{ verified: boolean; channelId?: string; channelTitle?: string; error?: string }> {

    // 1. Get all channels owned by the OAuth user
    let ytResponse: Response;
    try {
        ytResponse = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?mine=true&part=id,snippet',
            { headers: { Authorization: `Bearer ${providerToken}` } }
        );
    } catch {
        return { verified: false, error: 'youtube_api_failed' };
    }

    if (!ytResponse.ok) {
        console.error('[YouTube] API error:', ytResponse.status, await ytResponse.text());
        return { verified: false, error: 'youtube_api_failed' };
    }

    const ytData = await ytResponse.json();
    const ownedChannels: Array<{ id: string; snippet: { title: string; customUrl?: string } }> = ytData.items || [];

    if (ownedChannels.length === 0) {
        return { verified: false, error: 'no_youtube_channels' };
    }

    // 2. Try direct /channel/UCxxx match
    const directId = extractChannelIdFromUrl(claimedChannelUrl);
    if (directId) {
        const found = ownedChannels.find((ch) => ch.id === directId);
        if (found) {
            return { verified: true, channelId: found.id, channelTitle: found.snippet.title };
        }
        return { verified: false, error: 'channel_mismatch' };
    }

    // 3. Try /@handle or /c/name match
    const handle = extractHandleFromUrl(claimedChannelUrl);
    if (handle) {
        // First check if any owned channel's customUrl matches the handle
        const handleLower = handle.toLowerCase();
        const found = ownedChannels.find((ch) => {
            const customUrl = ch.snippet.customUrl?.toLowerCase().replace(/^@/, '');
            return customUrl === handleLower;
        });

        if (found) {
            return { verified: true, channelId: found.id, channelTitle: found.snippet.title };
        }

        // Fallback: resolve handle via YouTube API
        try {
            const resolveRes = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?forHandle=${handle}&part=id`,
                { headers: { Authorization: `Bearer ${providerToken}` } }
            );

            if (resolveRes.ok) {
                const resolveData = await resolveRes.json();
                const resolvedId = resolveData.items?.[0]?.id;

                if (resolvedId) {
                    const match = ownedChannels.find((ch) => ch.id === resolvedId);
                    if (match) {
                        return { verified: true, channelId: match.id, channelTitle: match.snippet.title };
                    }
                }
            }
        } catch {
            // Fallback failed — not fatal
        }
    }

    return { verified: false, error: 'channel_mismatch' };
}

// -------------------------------------------------------------------
// URL parsing utilities (local, not exported from server actions)
// -------------------------------------------------------------------

function extractChannelIdFromUrl(url: string): string | null {
    const channelMatch = url.match(/\/channel\/(UC[\w-]+)/);
    if (channelMatch) return channelMatch[1];
    return null;
}

function extractHandleFromUrl(url: string): string | null {
    const handleMatch = url.match(/\/@([\w.-]+)/);
    if (handleMatch) return handleMatch[1];

    const customMatch = url.match(/\/c\/([\w.-]+)/);
    if (customMatch) return customMatch[1];

    return null;
}
