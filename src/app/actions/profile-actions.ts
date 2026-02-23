'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { curateFeedForMission } from './curation-actions';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function updateProfile(formData: { name: string; email: string; goal: string; struggle: string }) {
    console.log('📝 Updating Profile:', formData);

    const cookieStore = await cookies();
    const missionId = cookieStore.get('veritas_user')?.value;

    if (!missionId) {
        return { success: false, message: "No active session. Please login or restart." };
    }

    // 1. Get User ID from Mission
    const { data: mission, error: missionFetchError } = await supabase
        .from('user_missions')
        .select('user_id, goal, obstacle')
        .eq('id', missionId)
        .single();

    if (missionFetchError || !mission) {
        return { success: false, message: "Mission not found." };
    }

    const userId = mission.user_id;

    // 2. Update Auth User (Name/Email)
    const { error: authError } = await supabase.auth.admin.updateUserById(
        userId,
        { email: formData.email, user_metadata: { full_name: formData.name } }
    );

    if (authError) {
        console.error("Auth Update Error:", authError);
        return { success: false, message: "Failed to update profile info." };
    }

    // 3. Update Mission (Goal/Struggle)
    const { error: missionUpdateError } = await supabase
        .from('user_missions')
        .update({
            goal: formData.goal,
            obstacle: formData.struggle
        })
        .eq('id', missionId);

    if (missionUpdateError) {
        console.error("Mission Update Error:", missionUpdateError);
        return { success: false, message: "Failed to update goals." };
    }

    // 4. Check if Goal/Struggle Changed -> Re-Curate
    if (mission.goal !== formData.goal || mission.obstacle !== formData.struggle) {
        console.log("🔄 Goals changed, regenerating feed...");
        const curationResult = await curateFeedForMission(missionId, formData.goal, formData.struggle);
        if (!curationResult.success) {
            return { success: true, message: "Profile updated, but feed generation failed." };
        }
    }

    return { success: true, message: "Profile updated successfully!" };
}

export async function updateProfileAvatar(avatarUrl: string) {
    const cookieStore = await cookies();
    const missionId = cookieStore.get('veritas_user')?.value;

    if (!missionId) {
        return { success: false, message: "No active session." };
    }

    // 1. Get User ID
    const { data: mission } = await supabase
        .from('user_missions')
        .select('user_id')
        .eq('id', missionId)
        .single();

    if (!mission) return { success: false, message: "Mission not found." };

    // 2. Update Auth Metadata
    const { error } = await supabase.auth.admin.updateUserById(
        mission.user_id,
        { user_metadata: { avatar_url: avatarUrl } }
    );

    if (error) {
        console.error("Avatar Update Error:", error);
        return { success: false, message: "Failed to update avatar." };
    }

    return { success: true };
}

export async function updateUserPassword(newPassword: string) {
    const cookieStore = await cookies();
    const missionId = cookieStore.get('veritas_user')?.value;

    if (!missionId) {
        return { success: false, message: "No active session." };
    }

    // 1. Get User ID
    const { data: mission } = await supabase
        .from('user_missions')
        .select('user_id')
        .eq('id', missionId)
        .single();

    if (!mission) return { success: false, message: "Profile not found." };

    // 2. Update Password via Admin
    const { error } = await supabase.auth.admin.updateUserById(
        mission.user_id,
        { password: newPassword }
    );

    if (error) {
        console.error("Password Update Error:", error);
        return { success: false, message: "Failed to update password." };
    }

    return { success: true };
}

