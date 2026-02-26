"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';

// Admin client to query raw tables securely
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export type UserProfile = {
    id: string;
    name: string;
};

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
    noStore(); // ALWAYS dynamic

    try {
        const cookieStore = await cookies();

        // 1. Resolve raw User ID
        let rawUserId: string | null = null;
        let isViewerFromCookie = false;

        // A. Check for Creator Login (Supabase Auth)
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
        const supabaseSsR = createServerClient(supabaseUrl, supabaseKey, {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { } // Read-only
            },
        });

        const { data: authData } = await supabaseSsR.auth.getUser();
        if (authData?.user?.id) {
            rawUserId = authData.user.id;
        }

        // B. If no auth session, check Viewer Cookie
        if (!rawUserId) {
            const missionId = cookieStore.get('veritas_user')?.value;
            if (missionId && missionId !== 'anonymous') {
                const { data: missionData } = await supabaseAdmin
                    .from('user_missions')
                    .select('user_id')
                    .eq('id', missionId)
                    .single();

                if (missionData?.user_id) {
                    rawUserId = missionData.user_id;
                    isViewerFromCookie = true;
                }
            }
        }

        if (!rawUserId) return null; // No profile mapping found

        // 2. Resolve Name matching strict fallback (Creators -> User_Missions -> Profiles)
        let resolvedName: string | null = null;

        // Fallback 1: Creators
        const { data: creator } = await supabaseAdmin
            .from('creators')
            .select('channel_name')
            .eq('user_id', rawUserId)
            .single();

        if (creator?.channel_name) {
            resolvedName = creator.channel_name;
        }

        // Fallback 2: User Missions
        if (!resolvedName) {
            const { data: mission } = await supabaseAdmin
                .from('user_missions')
                .select('name')
                .eq('user_id', rawUserId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (mission?.name) {
                resolvedName = mission.name;
            }
        }

        // Fallback 3: Profiles
        if (!resolvedName) {
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('username')
                .eq('id', rawUserId)
                .single();

            if (profile?.username) {
                resolvedName = profile.username;
            }
        }

        // If no name resolved, treat as no profile
        if (!resolvedName) return null;

        return {
            id: rawUserId,
            name: resolvedName
        };

    } catch (e) {
        console.error('Error fetching deep user profile:', e);
        return null;
    }
}
