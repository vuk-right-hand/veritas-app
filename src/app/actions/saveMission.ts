'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client (Service Role for secure backend ops if needed, or Anon if using RLS)
// For this action, we should ideally use the authenticated user's client if we had auth.
// But based on the flow, it seems to be a public onboarding leading to a signup/profile creation.
// If the user doesn't have an ID yet, we might need to create a shadow user or just store pending data.
// However, the `user_missions` table requires a `user_id`. 
// Assumption: We will use the service role to create a "shadow" profile if one doesn't exist, 
// or imply this runs after auth. 
// Given the form asks for Name/Email at step 3, we probably need to Create User -> Create Mission.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveMission(formData: { goal: string; struggle: string; name: string; email: string }) {
    console.log('🚀 Saving Mission:', formData);

    // 1. Check if user exists or create new one (Simplified Logic for MVP)
    // In a real app, this would trigger Auth SignUp. 
    // Here, we'll strip the email to find or create a profile.

    // Try to find user by email
    // NOTE: This is a simplified approach. Ideally we use Supabase Auth `signUp()`.

    // For now, let's assume we create a "guest" profile or link to an existing auth user if we can.
    // Since we don't have the Auth context here, let's do a "Get or Create Profile" flow using Service Role.

    // A. Create/Get User (Mock Auth for now, or actual DB insert)
    // Convert email to a consistent ID-like string or just generate UUID
    // Ideally, valid Supabase Auth user is needed for RLS.
    // Let's use `auth.admin.createUser` if we want to be proper, or just insert into profiles if we allow that.
    // But profiles.id references auth.users.id. So we MUST create an Auth user.

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: 'TemporaryPassword123!', // User would reset this later
        email_confirm: true,
        user_metadata: { full_name: formData.name }
    });

    let userId = authUser?.user?.id;

    if (authError) {
        console.log('⚠️ Auth User might already exist:', authError.message);
        // Try to fetching by email is hard with Admin API without specific call.
        // For MVP, if it fails, we might not be able to proceed without login.
        // Let's assume for this "Demo" we return an error or handle it.
        if (authError.message.includes('already registered')) {
            // In a real flow, we'd ask them to login.
            // potentially fetch ID from a backend lookup if safe, or easier: 
            // Just fail for now and say "User exists".
            return { success: false, message: "User already exists. Please login." };
        }
    }

    // B. Create Profile (Trigger usually handles this, but let's ensure)
    // trigger `on_auth_user_created` in schema.sql should have handled it.

    // C. Create Mission
    if (userId) {
        const { data: mission, error: missionError } = await supabase
            .from('user_missions')
            .insert([{
                user_id: userId,
                goal: formData.goal,
                obstacle: formData.struggle,
                preferences: {},
                name: formData.name,
                email: formData.email
            }])
            .select()
            .single();

        if (missionError) {
            console.error('❌ Mission Save Error:', missionError);
            return { success: false, message: "Failed to save mission." };
        }

        return { success: true, missionId: mission.id };
    }

    return { success: false, message: "Could not create user." };
}
