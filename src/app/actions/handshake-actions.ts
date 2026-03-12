"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        '[handshake-actions] Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.'
    );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Resolves the caller's user_id from auth session or veritas_user cookie.
async function resolveCallerId(): Promise<string | null> {
    const cookieStore = await cookies();

    // 1. Try Supabase auth session
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
    const supabaseSsr = createServerClient(supabaseUrl!, supabaseKey, {
        cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet: any[]) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch { /* Server Component — ignore */ }
            },
        },
    });

    const { data: authData } = await supabaseSsr.auth.getUser();
    if (authData?.user?.id) return authData.user.id;

    // 2. Fallback: veritas_user cookie → user_missions.user_id
    const missionId = cookieStore.get('veritas_user')?.value;
    if (missionId && missionId !== 'anonymous') {
        const { data: mission } = await supabaseAdmin
            .from('user_missions')
            .select('user_id')
            .eq('id', missionId)
            .single();
        if (mission?.user_id) return mission.user_id;
    }

    return null;
}

// Creates an SSR client that carries the user's auth session (for RLS-protected queries).
async function createAuthenticatedSsrClient() {
    const cookieStore = await cookies();
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';
    return createServerClient(supabaseUrl!, supabaseKey, {
        cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet: any[]) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch { /* Server Component — ignore */ }
            },
        },
    });
}

// ─── Public reads (admin client — count is public data) ─────────────────────

export async function getHandshakeCount(creatorId: string): Promise<number> {
    noStore();
    const { count, error } = await supabaseAdmin
        .from('handshakes')
        .select('*', { count: 'exact', head: true })
        .eq('creator_id', creatorId);

    if (error) {
        console.error('[handshake-actions] getHandshakeCount error:', error);
        return 0;
    }
    return count || 0;
}

// ─── Auth-gated reads (SSR client with RLS — no userId param) ───────────────

export async function isHandshaked(creatorId: string): Promise<boolean> {
    noStore();
    const userId = await resolveCallerId();
    if (!userId) return false;

    // Use admin to check since viewer-cookie users don't have a Supabase auth session for RLS
    const { data, error } = await supabaseAdmin
        .from('handshakes')
        .select('id')
        .eq('user_id', userId)
        .eq('creator_id', creatorId)
        .maybeSingle();

    if (error) {
        console.error('[handshake-actions] isHandshaked error:', error);
        return false;
    }
    return !!data;
}

export type HandshakeCreator = {
    creatorId: string;
    channelName: string;
    avatarUrl: string | null;
    slug: string | null;
};

export async function getUserHandshakes(): Promise<HandshakeCreator[]> {
    noStore();
    const userId = await resolveCallerId();
    if (!userId) return [];

    // Fetch handshake rows for this user (admin bypasses RLS since viewer-cookie users
    // don't have a Supabase auth session). Security: userId resolved server-side, never from client.
    const { data: handshakes, error } = await supabaseAdmin
        .from('handshakes')
        .select('creator_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error || !handshakes?.length) {
        if (error) console.error('[handshake-actions] getUserHandshakes error:', error);
        return [];
    }

    const creatorIds = handshakes.map(h => h.creator_id);

    // Batch-fetch creator details
    const { data: creators } = await supabaseAdmin
        .from('creators')
        .select('id, channel_name, avatar_url, slug')
        .in('id', creatorIds);

    if (!creators) return [];

    // Preserve handshake order
    const creatorMap = new Map(creators.map(c => [c.id, c]));
    return creatorIds
        .map(id => {
            const c = creatorMap.get(id);
            if (!c) return null;
            return {
                creatorId: c.id,
                channelName: c.channel_name,
                avatarUrl: c.avatar_url || null,
                slug: c.slug || null,
            };
        })
        .filter((x): x is HandshakeCreator => x !== null);
}

// ─── Mutations (resolve caller server-side) ─────────────────────────────────

export async function toggleHandshake(creatorId: string): Promise<{ handshaked: boolean; count: number; error?: string }> {
    noStore();
    const userId = await resolveCallerId();
    if (!userId) return { handshaked: false, count: 0, error: 'unauthenticated' };

    // Check if handshake already exists
    const { data: existing } = await supabaseAdmin
        .from('handshakes')
        .select('id')
        .eq('user_id', userId)
        .eq('creator_id', creatorId)
        .maybeSingle();

    if (existing) {
        // Un-handshake
        const { error } = await supabaseAdmin
            .from('handshakes')
            .delete()
            .eq('id', existing.id);

        if (error) {
            console.error('[handshake-actions] toggleHandshake delete error:', error);
            return { handshaked: true, count: 0, error: 'Failed to remove handshake' };
        }
    } else {
        // Handshake
        const { error } = await supabaseAdmin
            .from('handshakes')
            .insert({ user_id: userId, creator_id: creatorId });

        if (error) {
            console.error('[handshake-actions] toggleHandshake insert error:', error);
            return { handshaked: false, count: 0, error: 'Failed to handshake' };
        }
    }

    const count = await getHandshakeCount(creatorId);
    return { handshaked: !existing, count };
}
