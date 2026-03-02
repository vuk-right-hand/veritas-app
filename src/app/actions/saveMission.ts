'use server';

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateEmbedding } from '@/lib/gemini';
import { curateFeedForMission } from './curation-actions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        '[saveMission] Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or ' +
        'SUPABASE_SERVICE_ROLE_KEY. Add them in Vercel → Settings → Environment Variables.'
    );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveMission(formData: { goal: string; struggle: string; name: string; email: string; password?: string }) {
    console.log('🚀 Saving Mission:', formData);

    const cookieStore = await cookies();

    // 1. Create the auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password || 'TemporaryPassword123!',
        email_confirm: true,
        user_metadata: { full_name: formData.name }
    });

    let userId = authUser?.user?.id;

    if (authError) {
        console.error('[saveMission] createUser error:', authError.message);
        if (authError.message.toLowerCase().includes('already registered')) {
            return { success: false, message: "An account with this email already exists. Please log in." };
        }
        return { success: false, message: `Registration failed: ${authError.message}` };
    }

    if (!userId) {
        return { success: false, message: "Could not create user account. Please try again." };
    }

    // 2. CRITICAL: Ensure a profile row exists for this user.
    // Supabase Auth does NOT auto-create profiles rows — we must do it manually here.
    // Without this, quiz submit UPDATE will fail silently (0 rows affected) and skills won't be tracked.
    const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
            id: userId,
            skills_matrix: {},
        }, { onConflict: 'id', ignoreDuplicates: true });

    if (profileError) {
        console.warn('⚠️ Could not pre-create profile row (may be OK if it already exists):', profileError.message);
    } else {
        console.log(`✅ Profile row ensured for user ${userId}`);
    }

    // 3. Create Mission
    const { data: mission, error: missionError } = await supabase
        .from('user_missions')
        .insert([{
            user_id: userId,
            goal: formData.goal,
            obstacle: formData.struggle,
            name: formData.name,
            email: formData.email,
            preferences: {},
            status: 'active'
        }])
        .select()
        .single();

    if (missionError) {
        console.error('❌ Mission Save Error:', missionError);
        return { success: false, message: "Failed to save mission." };
    }

    console.log(`✅ Mission Created: ${mission.id}`);

    // 4. Set Session Cookie FIRST so the user has a valid session even if curation fails.
    cookieStore.set('veritas_user', mission.id, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    // 5. Also establish a Supabase auth session in cookies so the /claim-channel bypass
    // detection (getAuthenticatedUserId via SSR) works when this user later upgrades to creator.
    // Non-fatal: if sign-in fails the veritas_user cookie above still provides viewer access.
    try {
        const supabaseSsr = createServerClient(
            supabaseUrl!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => cookieStore.getAll(),
                    setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                }
            }
        );
        await supabaseSsr.auth.signInWithPassword({
            email: formData.email,
            password: formData.password || 'TemporaryPassword123!'
        });
    } catch (signInErr) {
        console.warn('[saveMission] Auth session not set (non-fatal):', signInErr);
    }

    // 6. SMART Curation — non-fatal. If Gemini is unavailable the user still lands on the
    // feed and will see generic verified videos until curation runs on next login.
    try {
        const curationResult = await curateFeedForMission(mission.id, formData.goal, formData.struggle);
        if (!curationResult.success) {
            console.warn("⚠️ Initial curation warning:", curationResult.message);
        }
    } catch (curationErr) {
        console.warn("⚠️ Initial curation threw — proceeding without curated feed:", curationErr);
    }

    return { success: true, missionId: mission.id };
}
