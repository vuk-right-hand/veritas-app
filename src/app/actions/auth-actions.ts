"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

// Initialize Supabase Admin Client (Service Role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

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

        // 1. Check if user exists or create new one
        // We use admin.createUser which handles both cases (returns error if exists)
        // Actually, listUsers is safer to check existence first to avoid error handling mess
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) throw new Error("Failed to check user existence: " + listError.message);

        const existingUser = users.find(u => u.email === email);

        if (existingUser) {
            console.log(`[Authorization] Found existing user: ${existingUser.id}`);
            userId = existingUser.id;
            // Note: We are NOT updating the password for safety. User must login with existing credentials.
            // But for this flow, we assume they are claiming. 
            // In a real app complexity, we'd force login. Here we proceed with linking.
        } else {
            console.log(`[Authorization] Creating new user for ${email}`);
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true // Auto-confirm for this flow as they verified channel
            });

            if (createError) throw new Error("Failed to create user: " + createError.message);
            if (!newUser.user) throw new Error("User creation failed unexpectedly.");

            userId = newUser.user.id;
        }

        // 2. Link User to Channel in 'creators' table
        // First check if channel is already claimed
        // We'll use the channel URL or extract ID if possible. ideally we'd extract ID.
        // For this demo, we use the URL as unique identifier if we didn't extract ID earlier.
        // But better to use extracted ID if avaliable. 
        // We will query by URL since we stored it.

        // Check if creator profile exists for this channel
        const { data: existingCreator, error: fetchError } = await supabaseAdmin
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

        // 3. Create Creator Profile
        const { error: insertError } = await supabaseAdmin
            .from('creators')
            .insert({
                user_id: userId,
                channel_url: channelInfo.url,
                channel_name: channelInfo.title,
                channel_id: channelInfo.url, // Ideally should be Youtube ID, using URL as fallback unique key for now
                verification_token: channelInfo.token,
                is_verified: true,
                human_score: 100 // Default or fetch real score
            });

        if (insertError) {
            console.error("[Authorization] Insert Error:", insertError);
            throw new Error("Failed to create creator profile: " + insertError.message);
        }

        return { success: true, message: "Channel claimed successfully! You can now log in." };

    } catch (error: any) {
        console.error("[Authorization] Error:", error);
        return { success: false, message: error.message || "An unexpected error occurred." };
    }
}

export async function viewerLogin(email: string, password: string) {
    const cookieStore = await cookies();

    // Use anon key for sign in to verify credentials securely
    const supabaseAnon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key'
    );

    try {
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
            email,
            password
        });

        if (error || !data.user) {
            return { success: false, message: "Invalid email or password." };
        }

        // Find existing mission to sync feed
        const { data: mission, error: missionError } = await supabaseAdmin
            .from('user_missions')
            .select('id')
            .eq('user_id', data.user.id)
            .single();

        if (missionError || !mission) {
            return { success: false, message: "No profile found for this user." };
        }

        // Set cookie to establish session
        cookieStore.set('veritas_user', mission.id, {
            path: '/',
            httpOnly: true,
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
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                    } catch {
                        // Ignored in Server Action
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
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                    } catch {
                        // Ignored
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
        const { error: insertError } = await supabaseAdmin
            .from('creators')
            .insert({
                user_id: userId,
                public_contact_email: email, // The user-provided contact email
                channel_url: channelInfo.url,
                channel_name: channelInfo.title,
                channel_id: channelInfo.url, // Fallback
                verification_token: channelInfo.token,
                is_verified: true,
                human_score: 100 // Default
            });

        if (insertError) {
            console.error("[Authorization] Insert Error:", insertError);
            throw new Error("Failed to create creator profile: " + insertError.message);
        }

        return { success: true, message: "Channel successfully linked to your account!" };

    } catch (error: any) {
        console.error("[Authorization] Error:", error);
        return { success: false, message: error.message || "An unexpected error occurred." };
    }
}
