'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { generateEmbedding } from '@/lib/gemini';
import { curateFeedForMission } from './curation-actions';

// Initialize Supabase Client (Service Role for secure backend ops if needed, or Anon if using RLS)
// For this action, we should ideally use the authenticated user's client if we had auth.
// But based on the flow, it seems to be a public onboarding leading to a signup/profile creation.
// If the user doesn't have an ID yet, we might need to create a shadow user or just store pending data.
// However, the `user_missions` table requires a `user_id`. 
// Assumption: We will use the service role to create a "shadow" profile if one doesn't exist, 
// or imply this runs after auth. 
// Given the form asks for Name/Email at step 3, we probably need to Create User -> Create Mission.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveMission(formData: { goal: string; struggle: string; name: string; email: string; password?: string }) {
    console.log('🚀 Saving Mission:', formData);

    const cookieStore = await cookies();

    // 1. Check if user exists or create new one (Simplified Logic for MVP)
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
            // For MVP, if user exists, we try to find them (this is risky in prod without auth, but fine for demo)
            // Ideally we'd ask them to login.
            // Let's try to proceed by assuming we can't get the ID easily without login.
            // But wait! If we can't get ID, we can't create mission.
            return { success: false, message: "User already exists. Please login." };
        }
    }

    // 2. Create Mission
    if (userId) {
        const { data: mission, error: missionError } = await supabase
            .from('user_missions')
            .insert([{
                user_id: userId,
                goal: formData.goal,
                obstacle: formData.struggle,
                name: formData.name,       // Capture Name
                email: formData.email,     // Capture Email
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

        // 3. SMART Curation Logic (Using Shared Action)
        const curationResult = await curateFeedForMission(mission.id, formData.goal, formData.struggle);
        if (!curationResult.success) {
            console.warn("⚠️ Initial curation warning:", curationResult.message);
        }


        // 4. Set Session Cookie
        cookieStore.set('veritas_user', mission.id, {
            path: '/',
            httpOnly: true,
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        return { success: true, missionId: mission.id };
    }

    return { success: false, message: "Could not create user." };
}
