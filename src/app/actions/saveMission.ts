'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { generateEmbedding } from '@/lib/gemini';
import { curateFeedForMission } from './curation-actions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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
        console.log('⚠️ Auth User might already exist:', authError.message);
        if (authError.message.includes('already registered')) {
            return { success: false, message: "User already exists. Please login." };
        }
    }

    if (!userId) {
        return { success: false, message: "Could not create user." };
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

    // 4. SMART Curation
    const curationResult = await curateFeedForMission(mission.id, formData.goal, formData.struggle);
    if (!curationResult.success) {
        console.warn("⚠️ Initial curation warning:", curationResult.message);
    }

    // 5. Set Session Cookie
    cookieStore.set('veritas_user', mission.id, {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return { success: true, missionId: mission.id };
}
