'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { curateFeedForMission } from './curation-actions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        '[oauth-actions] Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or ' +
        'SUPABASE_SERVICE_ROLE_KEY.'
    );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * Called from auth/callback for onboarding OAuth users.
 * No password involved — user already exists in auth.users via OAuth.
 * Mirrors saveMission.ts logic but skips createUser.
 */
export async function saveMissionForOAuthUser(
    userId: string,
    email: string,
    name: string,
    goal: string,
    struggle: string
): Promise<{ success: boolean; missionId?: string; message?: string }> {
    console.log(`[OAuth] Saving mission for OAuth user ${userId}`);

    // 1. Ensure profile row exists
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(
            { id: userId, skills_matrix: {} },
            { onConflict: 'id', ignoreDuplicates: true }
        );

    if (profileError) {
        console.warn('[OAuth] Profile upsert warning:', profileError.message);
    }

    // 2. Insert user_missions row
    const { data: mission, error: missionError } = await supabaseAdmin
        .from('user_missions')
        .insert([{
            user_id: userId,
            goal,
            obstacle: struggle,
            name,
            email,
            preferences: {},
            status: 'active'
        }])
        .select()
        .single();

    if (missionError || !mission) {
        console.error('[OAuth] Mission insert error:', missionError);
        return { success: false, message: 'Failed to create mission.' };
    }

    // 3. Set veritas_user cookie
    const cookieStore = await cookies();
    cookieStore.set('veritas_user', mission.id, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // 4. Trigger curation (non-fatal)
    try {
        await curateFeedForMission(mission.id, goal, struggle);
    } catch (err) {
        console.warn('[OAuth] Curation non-fatal error:', err);
    }

    return { success: true, missionId: mission.id };
}

/**
 * Called from auth/callback for claim-channel Google OAuth users.
 * Google OAuth + YouTube API IS the verification — no token paste needed.
 */
export async function finalizeOAuthChannelClaim(
    userId: string,
    email: string,
    channelInfo: { url: string; title: string; channelId: string }
): Promise<{ success: boolean; message?: string }> {
    console.log(`[OAuth] Finalizing channel claim for ${userId}: ${channelInfo.url}`);

    // 1. Check if channel already claimed
    const { data: existing } = await supabaseAdmin
        .from('creators')
        .select('id, user_id')
        .eq('channel_url', channelInfo.url)
        .single();

    if (existing) {
        if (existing.user_id !== userId) {
            return { success: false, message: 'This channel is already claimed by another user.' };
        }
        return { success: true, message: 'Channel already linked.' };
    }

    // 2. Insert creators row
    const { error } = await supabaseAdmin
        .from('creators')
        .insert({
            user_id: userId,
            channel_url: channelInfo.url,
            channel_name: channelInfo.title,
            channel_id: channelInfo.channelId,
            public_contact_email: email,
            is_verified: true,
            human_score: 100
        });

    if (error) {
        console.error('[OAuth] Creator insert error:', error);
        return { success: false, message: 'Failed to create creator profile: ' + error.message };
    }

    // Mark the channel as claimed in the channels table
    const handleMatch = channelInfo.url.match(/@([^/?]+)/);
    const channelSlug = handleMatch ? handleMatch[1] : channelInfo.url.split('/').filter(Boolean).pop();
    if (channelSlug) {
        await supabaseAdmin
            .from('channels')
            .update({ is_claimed: true, owner_id: userId })
            .eq('youtube_channel_id', channelSlug);
    }

    revalidatePath('/', 'layout');
    return { success: true, message: 'Channel claimed successfully via Google!' };
}

/**
 * Called from auth/callback for the viewer login flow.
 * Creator login uses the separate 'creator-login' flow which bypasses this entirely.
 */
export async function establishOAuthViewerSession(
    userId: string
): Promise<{ success: boolean; destination: string; isNewUser?: boolean }> {
    const cookieStore = await cookies();

    // Check for existing mission (viewer path)
    const { data: missions } = await supabaseAdmin
        .from('user_missions')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

    const mission = missions?.[0];

    if (mission) {
        cookieStore.set('veritas_user', mission.id, {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7
        });
        return { success: true, destination: '/dashboard' };
    }

    // Fallback: creator with no mission row
    const { data: creator } = await supabaseAdmin
        .from('creators')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .single();

    if (creator) {
        return { success: true, destination: '/creator-dashboard' };
    }

    // Brand new OAuth user with no data — send to onboarding (must complete profile first)
    return { success: true, destination: '/onboarding', isNewUser: true };
}

