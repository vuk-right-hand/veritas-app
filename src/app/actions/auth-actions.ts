"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { slugify } from '@/lib/utils';

// Initialize Supabase Admin Client (Service Role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        '[auth-actions] Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or ' +
        'SUPABASE_SERVICE_ROLE_KEY. Add them in Vercel → Settings → Environment Variables.'
    );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export async function finalizeChannelClaim(
    email: string,
    password: string,
    channelInfo: {
        url: string;
        title: string;
        token: string;
    }
) {
    console.log(`[Authorization] Attempting to claim channel ${channelInfo.title} for ${email}`);

    try {
        // --- NEW SECURITY CHECK ---
        const { data: request, error: verifyFetchError } = await supabaseAdmin
            .from('verification_requests')
            .select('verified')
            .eq('email', email)
            .eq('channel_url', channelInfo.url)
            .eq('token', channelInfo.token)
            .single();

        if (verifyFetchError || !request?.verified) {
            console.error("[Authorization] Security Violation: Channel ownership not verified.");
            return { success: false, message: "Security Violation: Channel ownership not verified." };
        }
        // --- END SECURITY CHECK ---

        let userId = "";

        // 1. Check if user exists or create new one.
        // SECURITY PATCH C4: Try-create pattern instead of listUsers() which is O(n).
        // The JS admin SDK has no getUserByEmail — so we attempt createUser first.
        // If the user already exists Supabase returns an error; we then look them up
        // via user_missions (which stores email) as a reliable O(1) fallback.
        const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (!createError && newUserData?.user) {
            console.log(`[Authorization] Created new user: ${newUserData.user.id}`);
            userId = newUserData.user.id;
        } else {
            // User likely already exists — look up via user_missions by email
            const { data: missionData } = await supabaseAdmin
                .from('user_missions')
                .select('user_id')
                .eq('email', email)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (missionData?.user_id) {
                console.log(`[Authorization] Found existing user via mission: ${missionData.user_id}`);
                userId = missionData.user_id;
                // Sync the new password the user just entered so creatorLogin() can succeed.
                // Without this, creatorLogin() would try the new password against the old one and fail silently.
                await supabaseAdmin.auth.admin.updateUserById(userId, { password });
            } else {
                throw new Error(createError?.message || "Failed to create or locate user account.");
            }
        }

        // 2. Link User to Channel in 'creators' table
        // First check if channel is already claimed
        // We'll use the channel URL or extract ID if possible. ideally we'd extract ID.
        // For this demo, we use the URL as unique identifier if we didn't extract ID earlier.
        // But better to use extracted ID if avaliable. 
        // We will query by URL since we stored it.

        // Check if creator profile exists for this channel
        const { data: existingCreator } = await supabaseAdmin
            .from('creators')
            .select('id, user_id')
            .eq('channel_url', channelInfo.url)
            .single();

        if (existingCreator) {
            // Already claimed?
            if (existingCreator.user_id !== userId) {
                return { success: false, message: "This channel is already claimed by another user." };
            }
            // Already linked to this user, just return success
            return { success: true, message: "Channel already linked to this account." };
        }

        // 3. Create Creator Profile - Slug Generation & Collision Trap
        let generatedSlug = slugify(channelInfo.title).substring(0, 100);
        let insertSuccess = false;

        while (!insertSuccess) {
            const { error: insertError } = await supabaseAdmin
                .from('creators')
                .insert({
                    user_id: userId,
                    slug: generatedSlug,
                    channel_url: channelInfo.url,
                    channel_name: channelInfo.title,
                    channel_id: channelInfo.url, // Ideally should be Youtube ID, using URL as fallback unique key for now
                    verification_token: channelInfo.token,
                    is_verified: true,
                    human_score: 100 // Default or fetch real score
                });

            if (insertError) {
                // Postgres Unique Constraint Violation is 23505
                if (insertError.code === '23505' && insertError.message.includes('slug')) {
                    // Append random string and retry
                    generatedSlug = `${slugify(channelInfo.title).substring(0, 95)}-${Math.random().toString(36).substring(2, 6)}`;
                    continue;
                }
                console.error("[Authorization] Insert Error:", insertError);
                throw new Error("Failed to create creator profile: " + insertError.message);
            }
            insertSuccess = true;
        }

        return { success: true, message: "Channel claimed successfully! You can now log in." };

    } catch (error: any) {
        console.error("[Authorization] Error:", error);
        return { success: false, message: error.message || "An unexpected error occurred." };
    }
}

export async function getAuthenticatedUserId(): Promise<string | null> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
}

export async function viewerLogin(email: string, password: string) {
    const cookieStore = await cookies();

    // Use SSR cookie-persisting client so the Supabase auth session is stored in
    // HTTP cookies. Without this, the session lives only in-memory and the
    // /claim-channel bypass (which reads SSR cookies) never detects the session.
    const supabaseAnon = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );

    try {
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.user) {
            return { success: false, message: "Invalid email or password." };
        }

        // Find existing mission to sync feed — .limit(1) avoids PGRST116 if user has
        // zero missions or multiple partial registrations (.single() would throw for both).
        const { data: missions, error: missionError } = await supabaseAdmin
            .from('user_missions')
            .select('id')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: false })
            .limit(1);

        const mission = missions?.[0] ?? null;

        if (missionError) {
            console.error('[viewerLogin] Mission lookup error:', missionError);
            return { success: false, message: "Could not load your profile. Please try again." };
        }
        if (!mission) {
            return { success: false, message: "No profile found. Please complete onboarding first." };
        }

        // Set cookie to establish session
        // SECURITY PATCH M1: Added secure + sameSite to prevent transmission over HTTP
        // and mitigate CSRF. Vercel enforces HTTPS but the cookie policy must also enforce it.
        cookieStore.set('veritas_user', mission.id, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message || "An unexpected error occurred." };
    }
}

export async function creatorLogin(email: string, password: string) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message || "An unexpected error occurred." };
    }
}

export async function claimChannelForExistingUser(
    email: string,
    channelInfo: {
        url: string;
        title: string;
        token: string;
    }
) {
    console.log(`[Authorization] Attempting to link channel ${channelInfo.title} to existing session`);

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );

    try {
        // --- 1. SECURELY GET USER ID ---
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error("[Authorization] Unauthorized link attempt.");
            return { success: false, message: "You must be logged in to link a channel." };
        }

        const userId = user.id;

        // --- 2. SECURITY CHECK ---
        const { data: request, error: verifyFetchError } = await supabaseAdmin
            .from('verification_requests')
            .select('verified')
            .eq('email', email)
            .eq('channel_url', channelInfo.url)
            .eq('token', channelInfo.token)
            .single();

        if (verifyFetchError || !request?.verified) {
            console.error("[Authorization] Security Violation: Channel ownership not verified.");
            return { success: false, message: "Security Violation: Channel ownership not verified." };
        }
        // --- END SECURITY CHECK ---

        // 3. Link User to Channel in 'creators' table
        const { data: existingCreator } = await supabaseAdmin
            .from('creators')
            .select('id, user_id')
            .eq('channel_url', channelInfo.url)
            .single();

        if (existingCreator) {
            if (existingCreator.user_id !== userId) {
                return { success: false, message: "This channel is already claimed by another user." };
            }
            return { success: true, message: "Channel already linked to this account." };
        }

        // 4. Create Creator Profile
        let generatedSlug = slugify(channelInfo.title).substring(0, 100);
        let insertSuccess = false;

        while (!insertSuccess) {
            const { error: insertError } = await supabaseAdmin
                .from('creators')
                .insert({
                    user_id: userId,
                    slug: generatedSlug,
                    public_contact_email: email, // The user-provided contact email
                    channel_url: channelInfo.url,
                    channel_name: channelInfo.title,
                    channel_id: channelInfo.url, // Fallback
                    verification_token: channelInfo.token,
                    is_verified: true,
                    human_score: 100 // Default
                });

            if (insertError) {
                // Postgres Unique Constraint Violation is 23505
                if (insertError.code === '23505' && insertError.message.includes('slug')) {
                    generatedSlug = `${slugify(channelInfo.title).substring(0, 95)}-${Math.random().toString(36).substring(2, 6)}`;
                    continue;
                }
                console.error("[Authorization] Insert Error:", insertError);
                throw new Error("Failed to create creator profile: " + insertError.message);
            }
            insertSuccess = true;
        }

        // SECURITY PATCH H2: Bust the Next.js cache so the UserContext and
        // creator-dashboard route reflect the new creator role immediately without
        // requiring a hard reload. Without this, the server component cache keeps
        // the user in a ghost non-creator state after upgrade.
        revalidatePath('/', 'layout');

        return { success: true, message: "Channel successfully linked to your account!" };

    } catch (error: any) {
        console.error("[Authorization] Error:", error);
        return { success: false, message: error.message || "An unexpected error occurred." };
    }
}

// ---------------------------------------------------------------------------
// Password Reset (verifyOtp flow — no PKCE code_verifier dependency)
// ---------------------------------------------------------------------------

export async function sendPasswordReset(email: string) {
    try {
        // Use the admin client (not SSR) to trigger the recovery email.
        // This avoids the PKCE code_verifier cookie problem entirely — SSR
        // clients store a code_verifier that expires before the user clicks
        // the email link, causing exchangeCodeForSession to fail.
        //
        // Instead, the Supabase Recovery email template links directly to
        // /auth/confirm?token_hash={{.TokenHash}}&type=recovery&next=/update-password
        // and that route uses verifyOtp() — no code_verifier needed.
        //
        // No `redirectTo` needed since the email template handles routing.
        await supabaseAdmin.auth.resetPasswordForEmail(email);
    } catch (err) {
        // Catastrophic failure (network, Supabase outage)
        console.error('[sendPasswordReset] Unexpected error:', err);
        return { success: false, message: 'Something went wrong. Please try again later.' };
    }

    // Anti-enumeration: always return the same generic message regardless of
    // whether the email exists, Supabase rate-limited us, or anything else.
    // Only a 500-level catastrophic failure surfaces an error above.
    return {
        success: true,
        message: 'If an account exists for this email, a password reset link has been sent.',
    };
}

export async function updatePasswordFromReset(newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters.' };
    }

    const cookieStore = await cookies();

    // SSR client — session cookie was set by /auth/callback code exchange
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );

    try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });

        // Supabase rejects if the new password is identical to the current one.
        // From the user's perspective this is still a success — their password is what they want.
        const isSamePasswordError =
            !!error &&
            (error.message.toLowerCase().includes('same password') ||
             error.message.toLowerCase().includes('different from the old') ||
             error.message.toLowerCase().includes('should be different'));

        if (error && !isSamePasswordError) {
            console.error('[updatePasswordFromReset] updateUser error:', error.message);
            return { success: false, message: 'Failed to update password. Your reset link may have expired.' };
        }

        // Establish veritas_user cookie so the dashboard loads correctly
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: missions } = await supabaseAdmin
                .from('user_missions')
                .select('id')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            const mission = missions?.[0] ?? null;
            if (mission) {
                cookieStore.set('veritas_user', mission.id, {
                    path: '/',
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 7
                });
            }
        }

        return { success: true, message: 'Password updated successfully.' };
    } catch (e: any) {
        console.error('[updatePasswordFromReset] Unexpected error:', e);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function logoutUser() {
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );

    try {
        await supabase.auth.signOut();
        try {
            cookieStore.delete('veritas_user');
        } catch (e) { }

        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message || "An unexpected error occurred." };
    }
}
