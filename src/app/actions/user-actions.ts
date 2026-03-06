"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        '[user-actions] Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. ' +
        'Add them in Vercel → Settings → Environment Variables.'
    );
}

// Admin client to query raw tables securely
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export type UserProfile = {
    id: string;
    name: string;
    avatar_url?: string;
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
        const supabaseSsR = createServerClient(supabaseUrl!, supabaseKey, {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet: any[]) {
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

        let avatarUrl: string | undefined;
        try {
            const { data: adminUser } = await supabaseAdmin.auth.admin.getUserById(rawUserId);
            if (adminUser?.user?.user_metadata?.avatar_url) {
                avatarUrl = adminUser.user.user_metadata.avatar_url;
            }
        } catch (err) {
            console.error('Error fetching avatar url', err);
        }

        return {
            id: rawUserId,
            name: resolvedName,
            avatar_url: avatarUrl
        };

    } catch (e) {
        console.error('Error fetching deep user profile:', e);
        return null;
    }
}
