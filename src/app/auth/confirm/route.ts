import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Email-based token verification route (password recovery, email confirmation).
 *
 * Unlike OAuth flows that use PKCE `exchangeCodeForSession` (which requires a
 * code_verifier cookie set during the initial request), this route verifies
 * the token_hash directly via `verifyOtp`. This is critical for password reset
 * because the user may click the email link minutes/hours later — long after
 * the PKCE code_verifier cookie has expired.
 *
 * The Supabase Recovery email template must link here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;
    const next = searchParams.get('next') ?? '/dashboard';

    // Validate: only accept relative paths to prevent open-redirect
    const safeDest = next.startsWith('/') ? next : '/dashboard';

    if (!token_hash || !type) {
        return NextResponse.redirect(new URL('/login?error=invalid_link', origin));
    }

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

    // Verify the token and establish the session — no PKCE code_verifier needed
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (error) {
        console.error('[auth/confirm] verifyOtp failed:', error.message);
        return NextResponse.redirect(new URL('/login?error=exchange_failed', origin));
    }

    // Session is now established in cookies — redirect to destination
    const destinationResponse = NextResponse.redirect(new URL(safeDest, origin));

    // Propagate mutated cookies to the redirect response
    // (same pattern as /auth/callback — Next.js doesn't auto-attach them)
    const allCookies = cookieStore.getAll();
    allCookies.forEach(c => {
        // @ts-ignore
        destinationResponse.cookies.set(c.name, c.value, { ...c });
    });

    return destinationResponse;
}
