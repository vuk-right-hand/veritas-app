"use server";

import { createClient } from '@supabase/supabase-js';
import { unstable_noStore as noStore } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Fetch pre-generated quiz questions for a video
export async function getQuizQuestions(videoId: string) {
    noStore();
    const { data, error } = await supabase
        .from('video_quizzes')
        .select('*')
        .eq('video_id', videoId)
        .order('lesson_number', { ascending: true })
        .limit(6); // Support up to 6 (3 + 3 extra)

    if (error) {
        console.error('Error fetching quiz questions:', error);
        return [];
    }
    return data || [];
}

// Fetch user's skills matrix
export async function getUserSkillsMatrix(userId: string) {
    noStore();
    if (!userId) return {};

    const { data, error } = await supabase
        .from('profiles')
        .select('skills_matrix')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching skills matrix:', error);
        return {};
    }
    return data?.skills_matrix || {};
}

// Fetch user's quiz attempts for a specific video
export async function getUserQuizAttempts(userId: string, videoId: string) {
    noStore();
    const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('video_id', videoId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching quiz attempts:', error);
        return [];
    }
    return data || [];
}

// Resolve the veritas_user cookie (mission_id) → real user UUID
export async function getUserIdFromMission(missionId: string): Promise<string | null> {
    if (!missionId || missionId === 'anonymous') return null;
    noStore();

    const { data, error } = await supabase
        .from('user_missions')
        .select('user_id')
        .eq('id', missionId)
        .single();

    if (error || !data) {
        console.error('Error resolving mission to user_id:', error);
        return null;
    }
    return data.user_id || null;
}
