"use server";

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { resolveViewerIdReadOnly } from '@/lib/viewer-identity';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
        '[search-actions] Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or ' +
        'SUPABASE_SERVICE_ROLE_KEY.'
    );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

export async function logPriorityRequest(query: string): Promise<{ success: boolean; message: string }> {
    // 1. Auth check via SSR cookie client
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key',
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { success: false, message: 'Unauthorized' };
    }

    // 2. Validate + normalize (lowercase for case-insensitive dedup)
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || trimmed.length > 500) {
        return { success: false, message: 'Invalid query' };
    }

    // 3. Dedup — prevent same user logging same query twice
    const { data: existing } = await supabaseAdmin
        .from('content_gaps')
        .select('id')
        .eq('user_id', user.id)
        .eq('search_query', trimmed)
        .maybeSingle();

    if (existing) {
        return { success: true, message: 'Already requested' };
    }

    // 4. Insert
    const { error: insertError } = await supabaseAdmin
        .from('content_gaps')
        .insert({ user_id: user.id, search_query: trimmed });

    if (insertError) {
        console.error('[search-actions] logPriorityRequest insert error:', insertError);
        return { success: false, message: 'Failed to log request' };
    }

    return { success: true, message: 'Request logged' };
}

// Click-through logging for search results. Writes an analytics_events row
// so Phase 3 threshold tuning can correlate clicks with the score distribution
// already captured by /api/search. Fire-and-forget — errors are logged, never
// thrown to the UI. Uses supabaseAdmin (not anon) for payload-shape discipline:
// analytics_events has a public INSERT policy but the server path keeps the
// metadata schema consistent across writers.
export async function logSearchClick(
    query: string,
    videoId: string,
    rank: number,
    score: number | null,
): Promise<void> {
    const trimmed = (query || '').trim().toLowerCase();
    if (!trimmed || trimmed.length > 200 || !videoId) return;
    // videoId is a YouTube 11-char id in this app. Reject anything else so a
    // caller can't stuff arbitrary strings into analytics_events.target_id.
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return;
    // Gate on a resolvable viewer identity. This is an unauthenticated server
    // action otherwise — without a gate, anyone can poison the Phase 3
    // threshold-tuning data this was built to collect.
    try {
        const viewerId = await resolveViewerIdReadOnly();
        if (!viewerId) return;
    } catch {
        return;
    }
    try {
        const { error } = await supabaseAdmin.from('analytics_events').insert({
            event_type: 'search_click',
            target_id: videoId,
            metadata: {
                query: trimmed,
                rank,
                score,
            },
        });
        if (error) console.error('[search-actions] logSearchClick error:', error);
    } catch (e) {
        console.error('[search-actions] logSearchClick threw:', (e as Error).message);
    }
}
